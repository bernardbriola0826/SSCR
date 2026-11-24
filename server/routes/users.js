const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireAuth, requirePasswordChanged, requireRole } = require('../middleware/auth');
const { asyncHandler, audit, cleanText, parseId, validatePassword } = require('../lib/helpers');

const router = express.Router();
router.use(requireAuth, requirePasswordChanged, requireRole('admin'));

const ROLES = ['admin', 'staff', 'viewer'];

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, full_name AS "fullName", role, active,
            must_change_password AS "mustChangePassword", locked_until AS "lockedUntil",
            created_at AS "createdAt"
     FROM users ORDER BY username`
  );
  res.json({ users: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const username = cleanText(b.username, 50);
  const fullName = cleanText(b.fullName, 100);
  const role = cleanText(b.role, 20);
  const tempPassword = b.tempPassword;

  if (!username || !/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-50 letters, numbers, dots, dashes or underscores' });
  }
  if (!fullName) return res.status(400).json({ error: 'Full name is required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const problem = validatePassword(tempPassword, username);
  if (problem) return res.status(400).json({ error: problem });

  const hash = await bcrypt.hash(tempPassword, 12);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, must_change_password)
       VALUES ($1,$2,$3,$4,TRUE) RETURNING id`,
      [username, hash, fullName, role]
    );
    await audit(req, 'USER_CREATED', 'user', rows[0].id, `${username} (${role})`);
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    throw err;
  }
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user' });
  const b = req.body || {};
  const sets = [];
  const values = [];
  const add = (column, value) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) return res.status(400).json({ error: 'Invalid role' });
    if (id === req.user.id && b.role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }
    add('role', b.role);
  }
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') return res.status(400).json({ error: 'Invalid value' });
    if (id === req.user.id && b.active === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    add('active', b.active);
  }
  if (b.fullName !== undefined) {
    const fullName = cleanText(b.fullName, 100);
    if (!fullName) return res.status(400).json({ error: 'Full name cannot be empty' });
    add('full_name', fullName);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING username`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const changed = ['role', 'active', 'fullName'].filter((k) => b[k] !== undefined).join(', ');
  await audit(req, 'USER_UPDATED', 'user', id, `${rows[0].username}: ${changed}`);
  res.json({ ok: true });
}));

router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user' });
  const found = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
  if (!found.rows[0]) return res.status(404).json({ error: 'User not found' });

  const tempPassword = (req.body || {}).tempPassword;
  const problem = validatePassword(tempPassword, found.rows[0].username);
  if (problem) return res.status(400).json({ error: problem });

  const hash = await bcrypt.hash(tempPassword, 12);
  await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE,
            failed_attempts = 0, locked_until = NULL WHERE id = $2`,
    [hash, id]
  );
  await audit(req, 'USER_PASSWORD_RESET', 'user', id, found.rows[0].username);
  res.json({ ok: true });
}));

module.exports = router;
