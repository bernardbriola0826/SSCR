const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, audit, validatePassword, ROLES, isUsernameOnly } = require('../lib/helpers');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// Lets the login screen know whether to ask for a password.
router.get('/config', (req, res) => {
  res.json({ usernameOnly: isUsernameOnly() });
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const usernameOnly = isUsernameOnly();
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: usernameOnly ? 'Username is required' : 'Username and password are required' });
  }
  if (!usernameOnly && (typeof password !== 'string' || !password)) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
  const user = rows[0];
  const invalid = { error: 'Invalid username or password' };

  if (!user || !user.active || !ROLES.includes(user.role)) {
    if (!usernameOnly) await bcrypt.compare(password, DUMMY_HASH); // keeps timing similar for unknown users
    return res.status(401).json(invalid);
  }

  if (!usernameOnly && user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(423).json({ error: 'Account temporarily locked. Please try again later.' });
  }

  const ok = usernameOnly ? true : await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const attempts = user.failed_attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE users SET failed_attempts = 0, locked_until = NOW() + ($2::float8 * INTERVAL '1 minute') WHERE id = $1`,
        [user.id, LOCK_MINUTES]
      );
      await audit(req, 'LOGIN_LOCKED', 'auth', user.id, null, user.id);
    } else {
      await pool.query('UPDATE users SET failed_attempts = $1 WHERE id = $2', [attempts, user.id]);
      await audit(req, 'LOGIN_FAILED', 'auth', user.id, null, user.id);
    }
    return res.status(401).json(invalid);
  }

  await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });

  await audit(req, 'LOGIN_OK', 'auth', user.id, null, user.id);
  res.json({
    user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
    mustChangePassword: usernameOnly ? false : user.must_change_password,
  });
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await audit(req, 'LOGOUT', 'auth', req.user.id);
  res.clearCookie('token');
  res.json({ ok: true });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  const problem = validatePassword(newPassword, req.user.username);
  if (problem) return res.status(400).json({ error: problem });
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'New password must be different from the current one' });
  }

  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2',
    [hash, req.user.id]
  );
  await audit(req, 'PASSWORD_CHANGED', 'auth', req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
