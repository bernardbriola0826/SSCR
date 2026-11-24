const jwt = require('jsonwebtoken');
const pool = require('../db');
const { asyncHandler, ROLES, isUsernameOnly } = require('../lib/helpers');

// Checks the login cookie and loads the user fresh from the database,
// so a deactivated account or a changed role takes effect immediately.
const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  const { rows } = await pool.query(
    'SELECT id, username, full_name, role, active, must_change_password FROM users WHERE id = $1',
    [payload.id]
  );
  const user = rows[0];
  if (!user || !user.active || !ROLES.includes(user.role)) return res.status(401).json({ error: 'Account not available' });

  req.user = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    // OSAS has a single level of access: every active account can do everything.
    role: 'admin',
    mustChangePassword: isUsernameOnly() ? false : user.must_change_password,
  };
  next();
});

// Blocks access to data until the temporary password has been changed.
function requirePasswordChanged(req, res, next) {
  if (req.user.mustChangePassword) {
    return res.status(403).json({ error: 'You must change your password first' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    next();
  };
}

module.exports = { requireAuth, requirePasswordChanged, requireRole };
