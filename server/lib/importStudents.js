// Pure helpers for importing the Student Master List from a spreadsheet file.
// No database access here, so this file can be tested on its own.

const MAX_IMPORT_ROWS = 5000;

const LEVELS = ['Grade School', 'Junior High', 'Senior High', 'College'];

// Accepts the many ways offices write the level (case, spaces and punctuation are ignored).
const LEVEL_ALIASES = {
  gradeschool: 'Grade School', gs: 'Grade School', elementary: 'Grade School',
  elem: 'Grade School', primary: 'Grade School',
  juniorhigh: 'Junior High', juniorhighschool: 'Junior High', jhs: 'Junior High', jh: 'Junior High',
  seniorhigh: 'Senior High', seniorhighschool: 'Senior High', shs: 'Senior High', sh: 'Senior High',
  college: 'College', tertiary: 'College', collegiate: 'College', undergraduate: 'College',
};

// Column headers that map to each field (also matched with spaces/punctuation removed).
const COLUMN_ALIASES = {
  studentNo: ['studentid', 'studentno', 'studentnumber', 'studentidnumber', 'idnumber', 'idno', 'id'],
  lastName: ['lastname', 'surname', 'familyname', 'lname'],
  firstName: ['firstname', 'givenname', 'fname'],
  middleName: ['middlename', 'middleinitial', 'mi'],
  educationLevel: ['educationlevel', 'educlevel', 'level', 'schoollevel'],
  yearLevel: ['yearlevel', 'gradelevel', 'yeargradelevel', 'yearorgradelevel', 'yearandgradelevel', 'gradeyearlevel',
    'yearorgrade', 'yearandgrade', 'gradeyear', 'yearlvl', 'year', 'grade'],
  course: ['course', 'strand', 'courseorstrand', 'coursestrand', 'program', 'degree'],
  section: ['section', 'sec', 'block'],
  guardianName: ['guardianname', 'guardian', 'parentname', 'parentguardian', 'parent'],
  guardianContact: ['guardiancontact', 'guardiancontactnumber', 'guardiancontactno', 'parentcontact',
    'contactnumber', 'contactno', 'contact', 'guardianphone', 'mobile', 'phone'],
};

const MAX_LEN = {
  studentNo: 30, lastName: 80, firstName: 80, middleName: 80, educationLevel: 40,
  yearLevel: 30, course: 50, section: 30, guardianName: 120, guardianContact: 30,
};

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function clean(value, max) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

function normalizeLevel(value) {
  if (value == null) return null;
  return LEVEL_ALIASES[squash(value)] || null;
}

// Works out which file column feeds which field.
function mapHeaders(headers) {
  const lookup = {};
  for (const [field, names] of Object.entries(COLUMN_ALIASES)) {
    for (const n of names) lookup[n] = field;
  }
  const map = {}; // header text -> field
  const used = new Set();
  const unmapped = [];
  for (const h of headers) {
    const field = lookup[squash(h)];
    if (field && !used.has(field)) {
      map[h] = field;
      used.add(field);
    } else {
      unmapped.push(h);
    }
  }
  return { map, used, unmapped };
}

// items: [{ row, data: {header: value} }]. Returns valid rows, problem rows and column info.
function prepareImport(items, defaultLevel) {
  const headers = [];
  const seen = new Set();
  for (const it of items) {
    if (it && it.data && typeof it.data === 'object') {
      for (const h of Object.keys(it.data)) {
        if (!seen.has(h)) { seen.add(h); headers.push(h); }
      }
    }
  }
  const { map, used, unmapped } = mapHeaders(headers);

  const required = [['studentNo', 'Student ID'], ['lastName', 'Last Name'], ['firstName', 'First Name']];
  if (!defaultLevel) required.push(['educationLevel', 'Level']);
  const missingColumns = required.filter(([f]) => !used.has(f)).map(([, label]) => label);

  const valid = [];
  const invalid = [];
  const firstSeen = new Map();

  items.forEach((it, i) => {
    const row = it && Number.isInteger(it.row) ? it.row : i + 2;
    if (!it || !it.data || typeof it.data !== 'object') {
      invalid.push({ row, studentNo: null, error: 'Unreadable row' });
      return;
    }
    const d = {};
    for (const [h, field] of Object.entries(map)) d[field] = clean(it.data[h], MAX_LEN[field]);

    if (!d.studentNo) return invalid.push({ row, studentNo: null, error: 'Missing Student ID' });
    if (!d.lastName) return invalid.push({ row, studentNo: d.studentNo, error: 'Missing last name' });
    if (!d.firstName) return invalid.push({ row, studentNo: d.studentNo, error: 'Missing first name' });

    let level = d.educationLevel ? normalizeLevel(d.educationLevel) : defaultLevel;
    if (!level) {
      const why = d.educationLevel
        ? `Unknown level "${d.educationLevel}" (use Grade School, Junior High, Senior High or College)`
        : 'Missing level';
      return invalid.push({ row, studentNo: d.studentNo, error: why });
    }
    d.educationLevel = level;

    if (firstSeen.has(d.studentNo)) {
      return invalid.push({
        row, studentNo: d.studentNo,
        error: `Duplicate Student ID in the file (first on row ${firstSeen.get(d.studentNo)})`,
      });
    }
    firstSeen.set(d.studentNo, row);
    valid.push({ row, data: d });
  });

  return { valid, invalid, missingColumns, unmappedColumns: unmapped };
}

module.exports = { MAX_IMPORT_ROWS, LEVELS, normalizeLevel, mapHeaders, prepareImport };
