const express = require('express');
const pool = require('../db');
const { requireAuth, requirePasswordChanged, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../lib/helpers');

const router = express.Router();
router.use(requireAuth, requirePasswordChanged, requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 200, 1), 500);
  const { rows } = await pool.query(
    `SELECT a.id, a.created_at AS "createdAt", COALESCE(u.username, '(unknown)') AS username,
            a.action, a.entity, a.entity_id AS "entityId", a.details, a.ip_address AS "ip"
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.id DESC LIMIT $1`,
    [limit]
  );
  res.json({ entries: rows });
}));

module.exports = router;
