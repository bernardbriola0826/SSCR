// Creates an admin account. The password is hashed and must be changed at first login.
const readline = require('readline');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { validatePassword } = require('./lib/helpers');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let muted = false;
const realWrite = rl._writeToOutput;
rl._writeToOutput = function (text) {
  if (!muted) realWrite.call(rl, text);
};

const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
const askHidden = (q) =>
  new Promise((resolve) => {
    process.stdout.write(q);
    muted = true;
    rl.question('', (answer) => {
      muted = false;
      process.stdout.write('\n');
      resolve(answer);
    });
  });

(async () => {
  try {
    const username = (await ask('Admin username: ')).trim();
    const fullName = (await ask('Full name: ')).trim();
    const password = await askHidden('Temporary password (min 12 characters, hidden): ');

    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) throw new Error('Username must be 3-50 letters, numbers, dots, dashes or underscores.');
    if (!fullName) throw new Error('Full name is required.');
    const problem = validatePassword(password, username);
    if (problem) throw new Error(problem + '.');

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, must_change_password)
       VALUES ($1, $2, $3, 'admin', TRUE)`,
      [username, hash, fullName]
    );
    console.log(`Admin "${username}" created. They must change the password at first login.`);
  } catch (err) {
    console.error('Failed:', err.code === '23505' ? 'That username already exists.' : err.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
})();
