const express = require('express');
const pool = require('../db');
const { requireAuth, requirePasswordChanged, requireRole } = require('../middleware/auth');
const { asyncHandler, audit, cleanText, parseId } = require('../lib/helpers');
const { MAX_IMPORT_ROWS, normalizeLevel, prepareImport } = require('../lib/importStudents');

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

// Bulk import from a spreadsheet (the browser reads the CSV and sends the rows).
// dryRun: true only checks the file and reports what would happen; nothing is saved.
router.post('/import', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const dryRun = b.dryRun === true;
  const mode = b.mode === 'update' ? 'update' : 'skip';
  const defaultLevel = b.defaultLevel ? normalizeLevel(b.defaultLevel) : null;
  if (b.defaultLevel && !defaultLevel) return res.status(400).json({ error: 'Invalid default level' });

  if (!Array.isArray(b.rows) || b.rows.length === 0) {
    return res.status(400).json({ error: 'The file has no student rows to import' });
  }
  if (b.rows.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({
      error: `Too many rows (${b.rows.length}). Please import at most ${MAX_IMPORT_ROWS} students per file.`,
    });
  }

  const prepared = prepareImport(b.rows, defaultLevel);
  if (prepared.missingColumns.length) {
    return res.status(400).json({
      error: `The file is missing required column(s): ${prepared.missingColumns.join(', ')}`,
      unmappedColumns: prepared.unmappedColumns,
    });
  }

  const nos = prepared.valid.map((r) => r.data.studentNo);
  const existing = new Set();
  if (nos.length) {
    const found = await pool.query('SELECT student_no FROM students WHERE student_no = ANY($1::text[])', [nos]);
    found.rows.forEach((r) => existing.add(r.student_no));
  }
  const toCreate = prepared.valid.filter((r) => !existing.has(r.data.studentNo));
  const toExisting = prepared.valid.filter((r) => existing.has(r.data.studentNo));

  const summary = {
    total: b.rows.length,
    invalidCount: prepared.invalid.length,
    invalid: prepared.invalid.slice(0, 200),
    unmappedColumns: prepared.unmappedColumns,
  };

  if (dryRun) {
    return res.json({
      dryRun: true, ...summary,
      create: toCreate.length,
      update: mode === 'update' ? toExisting.length : 0,
      skip: mode === 'update' ? 0 : toExisting.length,
    });
  }

  const writeRows = mode === 'update' ? prepared.valid : toCreate;
  const conflict = mode === 'update'
    ? `DO UPDATE SET last_name = EXCLUDED.last_name, first_name = EXCLUDED.first_name,
         education_level = EXCLUDED.education_level,
         middle_name = COALESCE(EXCLUDED.middle_name, students.middle_name),
         year_level = COALESCE(EXCLUDED.year_level, students.year_level),
         course = COALESCE(EXCLUDED.course, students.course),
         section = COALESCE(EXCLUDED.section, students.section),
         guardian_name = COALESCE(EXCLUDED.guardian_name, students.guardian_name),
         guardian_contact = COALESCE(EXCLUDED.guardian_contact, students.guardian_contact)`
    : 'DO NOTHING';

  let created = 0;
  let updated = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { data: d } of writeRows) {
      const { rows } = await client.query(
        `INSERT INTO students (student_no, last_name, first_name, middle_name, education_level,
                               year_level, course, section, guardian_name, guardian_contact)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (student_no) ${conflict}
         RETURNING (xmax = 0) AS inserted`,
        [d.studentNo, d.lastName, d.firstName, d.middleName, d.educationLevel,
         d.yearLevel, d.course, d.section, d.guardianName, d.guardianContact]
      );
      if (rows[0]) {
        if (rows[0].inserted) created += 1;
        else updated += 1;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const skipped = prepared.valid.length - created - updated;
  await audit(req, 'STUDENT_IMPORT', 'student', null,
    `created ${created}, updated ${updated}, skipped ${skipped}, problems ${prepared.invalid.length}`);
  res.json({ dryRun: false, ...summary, created, updated, skipped });
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

// Deleting a student is refused while they still have violation records,
// so discipline history is never lost by accident. Delete those records first.
router.delete('/:id', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid student' });

  const blocked = { error: 'This student still has violation records. Delete those records first.' };
  try {
    const { rows } = await pool.query(
      `DELETE FROM students s
       WHERE s.id = $1 AND NOT EXISTS (SELECT 1 FROM violations v WHERE v.student_id = s.id)
       RETURNING s.student_no`,
      [id]
    );
    if (rows[0]) {
      await audit(req, 'STUDENT_DELETED', 'student', id, `student no. ${rows[0].student_no}`);
      return res.json({ ok: true });
    }
  } catch (err) {
    if (err.code === '23503') return res.status(409).json(blocked); // a record was added just now
    throw err;
  }

  const exists = await pool.query('SELECT 1 FROM students WHERE id = $1', [id]);
  if (!exists.rows[0]) return res.status(404).json({ error: 'Student not found' });
  res.status(409).json(blocked);
}));

module.exports = router;
