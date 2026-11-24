const pool = require('../db');

// Makes sure errors inside async route handlers reach the error handler.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Writes one line to the audit log. Never put passwords or full record text in `details`.
async function audit(req, action, entity, entityId, details, userIdOverride) {
  const userId = userIdOverride !== undefined ? userIdOverride : req.user ? req.user.id : null;
  await pool.query(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, action, entity || null, entityId != null ? String(entityId) : null, details || null, req.ip || null]
  );
}

// Returns an error message, or null if the password is acceptable.
function validatePassword(password, username) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password is too long (72 bytes maximum)';
  if (username && password.toLowerCase().includes(String(username).toLowerCase())) {
    return 'Password must not contain the username';
  }
  return null;
}

// Trims a string and enforces a maximum length. Returns null for empty input.
function cleanText(value, max) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function parseId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { asyncHandler, audit, validatePassword, cleanText, parseId };
