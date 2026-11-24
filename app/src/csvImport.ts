// @ts-nocheck
// Reads a CSV file saved from Excel/Google Sheets in the browser. No libraries needed.

// Excel's plain "CSV" is often Windows-1252, not UTF-8. Try UTF-8 first, then fall back,
// so names like "Peña" and "Muñoz" are not turned into garbage.
export function decodeCsvBytes(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] || '';
  let best = ',';
  let bestCount = -1;
  for (const d of [',', ';', '\t']) {
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count += 1;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

// Returns a list of records (each a list of cell strings). Handles quotes, "" escapes,
// commas/newlines inside quotes, and CRLF line endings.
export function parseCsv(text) {
  const delim = detectDelimiter(text);
  const records = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      records.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); records.push(row); }
  return records;
}

// Turns the file text into [{ row, data: { header: value } }] for the server.
// `row` is the spreadsheet row number (header is row 1), so error messages match Excel.
export function csvToItems(text) {
  const records = parseCsv(text);
  if (!records.length) return { headers: [], items: [] };
  const headers = records[0].map((h) => h.trim());
  const items = [];
  for (let r = 1; r < records.length; r += 1) {
    const rec = records[r];
    if (rec.every((c) => c.trim() === '')) continue; // skip blank lines
    const data = {};
    headers.forEach((h, i) => {
      if (h && !(h in data)) data[h] = (rec[i] || '').trim();
    });
    items.push({ row: r + 1, data });
  }
  return { headers: headers.filter(Boolean), items };
}

export const TEMPLATE_CSV =
  'Student ID,Last Name,First Name,Middle Name,Level,Year / Grade Level,Course / Strand,Section,Guardian Name,Guardian Contact\r\n' +
  '2026-0001,Dela Cruz,Juan,Santos,College,1st Year,BSIT,A,Maria Dela Cruz,09171234567\r\n' +
  'GS-0001,Bautista,Ana,,Grade School,Grade 4,,Mabini,Rosa Bautista,09171234568\r\n';
