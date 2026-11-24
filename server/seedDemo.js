// FAKE DEMO DATA FOR TESTING ONLY. Do not run this on the school's real database.
const pool = require('./db');

const students = [
  ['2024-001', 'Dela Cruz', 'Juan', 'Santos', 'College', '1st Year', 'BSIT', 'A', 'Maria Dela Cruz', '09170000001'],
  ['2024-002', 'Santos', 'Maria', 'Garcia', 'College', '2nd Year', 'BSBA', 'B', 'Pedro Santos', '09170000002'],
  ['2024-003', 'Reyes', 'Pedro', 'Lopez', 'College', '3rd Year', 'BSCS', 'A', 'Ana Reyes', '09170000003'],
  ['GS-0001', 'Bautista', 'Ana', null, 'Grade School', 'Grade 4', null, 'Mabini', 'Rosa Bautista', '09170000004'],
  ['JH-0001', 'Cruz', 'Luis', null, 'Junior High', 'Grade 8', null, 'Rizal', 'Elena Cruz', '09170000005'],
  ['SH-0001', 'Mendoza', 'Carla', null, 'Senior High', 'Grade 11', 'STEM', 'A', 'Jose Mendoza', '09170000006'],
];

const violations = [
  ['DEMO-0001', '2024-001', '2026-11-03T08:30:00+08:00', 'Tardiness', 'Arrived 30 minutes late without a valid excuse', 'Minor', 'Verbal Warning', 'Resolved', 'First offense'],
  ['DEMO-0002', '2024-002', '2026-11-10T14:15:00+08:00', 'Uniform Violation', 'Not wearing the proper school ID', 'Minor', 'Written Warning', 'Pending', 'Second offense this month'],
  ['DEMO-0003', 'JH-0001', '2026-11-18T10:00:00+08:00', 'Behavioral Misconduct', 'Disrupted class repeatedly', 'Major', 'Parent Conference', 'Ongoing', null],
  ['DEMO-0004', 'SH-0001', '2026-11-20T13:45:00+08:00', 'Academic Dishonesty', 'Caught copying during a quiz', 'Critical', 'Suspension', 'Pending', null],
];

(async () => {
  try {
    for (const s of students) {
      await pool.query(
        `INSERT INTO students (student_no, last_name, first_name, middle_name, education_level,
                               year_level, course, section, guardian_name, guardian_contact)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (student_no) DO NOTHING`,
        s
      );
    }
    for (const [recordNo, studentNo, when, type, details, severity, sanction, status, remarks] of violations) {
      await pool.query(
        `INSERT INTO violations (record_no, student_id, occurred_at, violation_type, details,
                                 severity, sanction, status, remarks)
         SELECT $1::varchar, id, $3::timestamptz, $4::varchar, $5::text, $6::varchar, $7::varchar, $8::varchar, $9::text FROM students WHERE student_no = $2
         ON CONFLICT (record_no) DO NOTHING`,
        [recordNo, studentNo, when, type, details, severity, sanction, status, remarks]
      );
    }
    console.log('Demo data added (fake students and violations).');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
