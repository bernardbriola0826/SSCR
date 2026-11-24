const express = require('express');
const pool = require('../db');
const { requireAuth, requirePasswordChanged, requireRole } = require('../middleware/auth');
const { asyncHandler, audit, cleanText, parseId } = require('../lib/helpers');

const router = express.Router();
router.use(requireAuth, requirePasswordChanged);

const LEVELS = ['Grade School', 'Junior High', 'Senior High', 'College'];

const SELECT = `
  SELECT s.id, s.student_no AS "studentNo", s.last_name AS "lastName", s.first_name AS "firstName",
         s.middle_name AS "middleName", s.education_level AS "educationLevel",
         s.year_level AS "yearLevel", s.course, s.section,
         s.guardian_name AS "guardianName", s.guardian_contact AS "guardianContact",
         (SELECT COUNT(*)::int FROM violations v WHERE v.student_id = s.id) AS "violationCount"
  FROM students s`;

function readStudent(body) {
  const b = body || {};
  const data = {
    studentNo: cleanText(b.studentNo, 30),
    lastName: cleanText(b.lastName, 80),
    firstName: cleanText(b.firstName, 80),
    middleName: cleanText(b.middleName, 80),
    educationLevel: cleanText(b.educationLevel, 20),
    yearLevel: cleanText(b.yearLevel, 30),
    course: cleanText(b.course, 50),
    section: cleanText(b.section, 30),
    guardianName: cleanText(b.guardianName, 120),
    guardianContact: cleanText(b.guardianContact, 30),
  };
  if (!data.studentNo || !data.lastName || !data.firstName) {
    return { error: 'Student ID, last name and first name are required' };
  }
  if (!LEVELS.includes(data.educationLevel)) {
    return { error: 'Please choose a valid education level' };
  }
  return { data };
}

router.get('/', asyncHandler(async (req, res) => {
  const q = cleanText(req.query.q, 80);
  const pattern = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
  const { rows } = await pool.query(
    `${SELECT}
     WHERE ($1::text IS NULL OR s.student_no ILIKE $1 OR s.last_name ILIKE $1 OR s.first_name ILIKE $1)
     ORDER BY s.last_name, s.first_name
     LIMIT 500`,
    [pattern]
  );
  res.json({ students: rows });
}));

router.post('/', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const { data, error } = readStudent(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `INSERT INTO students (student_no, last_name, first_name, middle_name, education_level,
                             year_level, course, section, guardian_name, guardian_contact)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [data.studentNo, data.lastName, data.firstName, data.middleName, data.educationLevel,
       data.yearLevel, data.course, data.section, data.guardianName, data.guardianContact]
    );
    await audit(req, 'STUDENT_CREATED', 'student', rows[0].id, `student no. ${data.studentNo}`);
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That Student ID already exists' });
    throw err;
  }
}));

router.put('/:id', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid student' });
  const { data, error } = readStudent(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rowCount } = await pool.query(
      `UPDATE students SET student_no=$1, last_name=$2, first_name=$3, middle_name=$4,
              education_level=$5, year_level=$6, course=$7, section=$8,
              guardian_name=$9, guardian_contact=$10
       WHERE id=$11`,
      [data.studentNo, data.lastName, data.firstName, data.middleName, data.educationLevel,
       data.yearLevel, data.course, data.section, data.guardianName, data.guardianContact, id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Student not found' });
    await audit(req, 'STUDENT_UPDATED', 'student', id, `student no. ${data.studentNo}`);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That Student ID already exists' });
    throw err;
  }
}));

module.exports = router;
