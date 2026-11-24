-- Safe to run more than once (uses IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'viewer')),
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_no VARCHAR(30) UNIQUE NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80),
  education_level VARCHAR(20) NOT NULL
    CHECK (education_level IN ('Grade School', 'Junior High', 'Senior High', 'College')),
  year_level VARCHAR(30),
  course VARCHAR(50),
  section VARCHAR(30),
  guardian_name VARCHAR(120),
  guardian_contact VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS violations (
  id SERIAL PRIMARY KEY,
  record_no VARCHAR(30) UNIQUE NOT NULL,
  student_id INT NOT NULL REFERENCES students(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  violation_type VARCHAR(100) NOT NULL,
  details TEXT,
  severity VARCHAR(20) NOT NULL,
  sanction VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  remarks TEXT,
  recorded_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50),
  entity_id VARCHAR(50),
  details TEXT,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violations_student ON violations(student_id);
CREATE INDEX IF NOT EXISTS idx_violations_occurred ON violations(occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
