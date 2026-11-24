// Creates the tables. Safe to run more than once.
const fs = require('fs');
const path = require('path');
const pool = require('./db');

(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('Database tables are ready.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
