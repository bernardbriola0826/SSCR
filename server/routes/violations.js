const express = require('express');
const pool = require('../db');
const { requireAuth, requirePasswordChanged, requireRole } = require('../middleware/auth');
const { asyncHandler, audit, cleanText, parseId } = require('../lib/helpers');

const router = express.Router();
router.use(requireAuth, requirePasswordChanged);

const SEVERITIES = ['Minor', 'Major', 'Critical'];
const STATUSES = ['Pending', 'Ongoing', 'Resolved', 'Dismissed'];

router.get('/', asyncHandler(async (req, res) => {
  const studentNo = cleanText(req.query.studentNo, 30);
  const status = cleanText(req.query.status, 20);
  const { rows } = await pool.query(
    `SELECT v.id, v.record_no AS "recordNo", v.occurred_at AS "occurredAt",
            s.student_no AS "studentNo", s.last_name || ', ' || s.first_name AS "studentName",
            s.education_level AS "educationLevel", s.year_level AS "yearLevel", s.course,
            v.violation_type AS "violationType", v.details, v.severity, v.sanction, v.status,
            v.remarks, u.full_name AS "recordedBy"
     FROM violations v
     JOIN students s ON s.id = v.student_id
     LEFT JOIN users u ON u.id = v.recorded_by
     WHERE ($1::text IS NULL OR s.student_no = $1) AND ($2::text IS NULL OR v.status = $2)
     ORDER BY v.occurred_at DESC, v.id DESC
     LIMIT 1000`,
    [studentNo, status]
  );
  res.json({ violations: rows });
}));

router.post('/', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const studentNo = cleanText(b.studentNo, 30);
  const violationType = cleanText(b.violationType, 100);
  const details = cleanText(b.details, 2000);
  const sanction = cleanText(b.sanction, 100);
  const remarks = cleanText(b.remarks, 2000);
  const severity = cleanText(b.severity, 20);
  const status = cleanText(b.status, 20) || 'Pending';
  const occurredAt = new Date(b.occurredAt);

  if (!studentNo || !violationType || !details) {
    return res.status(400).json({ error: 'Student ID, violation type and details are required' });
  }
  if (Number.isNaN(occurredAt.getTime())) {
    return res.status(400).json({ error: 'A valid date and time are required' });
  }
  if (!SEVERITIES.includes(severity)) return res.status(400).json({ error: 'Invalid severity' });
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const found = await pool.query('SELECT id FROM students WHERE student_no = $1', [studentNo]);
  if (!found.rows[0]) {
    return res.status(404).json({
      error: 'Student ID not found. Add the student in the Student Master List first.',
    });
  }

  const seq = await pool.query("SELECT nextval(pg_get_serial_sequence('violations', 'id')) AS id");
  const id = seq.rows[0].id;
  const day = occurredAt.toISOString().slice(0, 10).replace(/-/g, '');
  const recordNo = `${day}-${String(id).padStart(5, '0')}`;

  await pool.query(
    `INSERT INTO violations (id, record_no, student_id, occurred_at, violation_type, details,
                             severity, sanction, status, remarks, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, recordNo, found.rows[0].id, occurredAt.toISOString(), violationType, details,
     severity, sanction, status, remarks, req.user.id]
  );
  await audit(req, 'VIOLATION_CREATED', 'violation', id, `record ${recordNo}, student no. ${studentNo}`);
  res.status(201).json({ id: Number(id), recordNo });
}));

router.patch('/:id', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid record' });
  const b = req.body || {};
  const sets = [];
  const values = [];
  const add = (column, value) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
    add('status', b.status);
  }
  if (b.severity !== undefined) {
    if (!SEVERITIES.includes(b.severity)) return res.status(400).json({ error: 'Invalid severity' });
    add('severity', b.severity);
  }
  if (b.sanction !== undefined) add('sanction', cleanText(b.sanction, 100));
  if (b.remarks !== undefined) add('remarks', cleanText(b.remarks, 2000));
  if (b.details !== undefined) {
    const details = cleanText(b.details, 2000);
    if (!details) return res.status(400).json({ error: 'Details cannot be empty' });
    add('details', details);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE violations SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING record_no`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
  await audit(req, 'VIOLATION_UPDATED', 'violation', id, `record ${rows[0].record_no}`);
  res.json({ ok: true });
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid record' });
  const { rows } = await pool.query('DELETE FROM violations WHERE id = $1 RETURNING record_no', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
  await audit(req, 'VIOLATION_DELETED', 'violation', id, `record ${rows[0].record_no}`);
  res.json({ ok: true });
}));

module.exports = router;
