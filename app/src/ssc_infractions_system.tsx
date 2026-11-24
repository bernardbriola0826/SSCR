// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Download, Trash2 } from 'lucide-react';
import { decodeCsvBytes, csvToItems, TEMPLATE_CSV } from './csvImport';

const SEVERITIES = ['Minor', 'Major', 'Critical'];
const STATUSES = ['Pending', 'Ongoing', 'Resolved', 'Dismissed'];
const VIOLATION_TYPES = ['Tardiness', 'Uniform Violation', 'Behavioral Misconduct', 'Academic Dishonesty', 'Bullying/Harassment'];
const LEVELS = ['Grade School', 'Junior High', 'Senior High', 'College'];

const inputCls = 'w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none';
const bigInputCls = 'w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none';
const labelCls = 'block font-semibold mb-2 text-gray-700';
const btnCls = 'bg-gradient-to-r from-red-900 to-yellow-600 text-white font-bold px-6 py-3 rounded-lg hover:shadow-lg transition disabled:opacity-60';
const theadCls = 'bg-gradient-to-r from-red-900 to-yellow-600 text-white';

const sevCls = (s) => (s === 'Minor' ? 'bg-yellow-200 text-yellow-800' : s === 'Major' ? 'bg-orange-300 text-orange-900' : 'bg-red-500 text-white');
const statCls = (s) => (s === 'Resolved' ? 'bg-green-500 text-white' : s === 'Pending' ? 'bg-yellow-400 text-yellow-900' : 'bg-blue-500 text-white');

// ---------- helpers ----------

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

const pad = (n) => String(n).padStart(2, '0');
const toLocalDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stops spreadsheet formula injection
  return '"' + s.replace(/"/g, '""') + '"';
};

function exportCsv(rows) {
  const head = ['Record No', 'Date', 'Student ID', 'Student Name', 'Level', 'Violation', 'Severity', 'Status', 'Sanction', 'Recorded By'];
  const lines = [head.map(csvCell).join(',')].concat(
    rows.map((v) =>
      [v.recordNo, toLocalDate(v.occurredAt), v.studentNo, v.studentName, v.educationLevel, v.violationType, v.severity, v.status, v.sanction, v.recordedBy]
        .map(csvCell)
        .join(',')
    )
  );
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'violations.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const SchoolLogo = () => (
  <img src="/ssc-logo.png" alt="San Sebastian College-Recoletos seal" className="w-28 h-auto block drop-shadow-xl" />
);

const Header = ({ title, children }) => (
  <div className="text-center mb-6">
    <img src="/ssc-logo.png" alt="San Sebastian College-Recoletos seal" className="w-28 h-auto mx-auto mb-4" />
    <h1 className="text-3xl font-bold text-red-900 mb-2">{title}</h1>
    <p className="font-semibold text-lg text-red-900">San Sebastian College-Recoletos, Manila</p>
    <p className="text-gray-600 font-medium">Office of Student Affairs and Services</p>
    {children}
  </div>
);

// ---------- sign in / password change ----------

function LoginScreen({ onLogin, error, busy, usernameOnly }) {
  const [form, setForm] = useState({ username: '', password: '' });
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 to-yellow-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <Header title="🔐 Sign In">
          <p className="text-gray-700 mt-2">Student Infractions Tracking System</p>
        </Header>
        {error && <div className="mb-4 p-3 rounded bg-red-100 text-red-800">{error}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(form.username, form.password);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Username</label>
            <input type="text" autoComplete="username" autoFocus required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={bigInputCls} />
          </div>
          {!usernameOnly && (
            <div>
              <label className={labelCls}>Password</label>
              <input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={bigInputCls} />
            </div>
          )}
          <button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-red-900 to-yellow-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-60">
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ChangePasswordScreen({ user, onSubmit, onLogout }) {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.next !== f.confirm) return setError('The new passwords do not match');
    setBusy(true);
    try {
      await onSubmit(f.current, f.next);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 to-yellow-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <Header title="🔑 Set a New Password">
          <p className="text-gray-700 mt-2">Hello, {user?.fullName}. You must replace your temporary password before continuing.</p>
        </Header>
        {error && <div className="mb-4 p-3 rounded bg-red-100 text-red-800">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Temporary (current) password</label>
            <input type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} className={bigInputCls} />
          </div>
          <div>
            <label className={labelCls}>New password (at least 12 characters)</label>
            <input type="password" autoComplete="new-password" required minLength={12} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} className={bigInputCls} />
          </div>
          <div>
            <label className={labelCls}>Confirm new password</label>
            <input type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} className={bigInputCls} />
          </div>
          <button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-red-900 to-yellow-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-60">
            {busy ? 'Saving...' : 'Save New Password'}
          </button>
          <button type="button" onClick={onLogout} className="w-full text-gray-600 underline text-sm">Sign out</button>
        </form>
      </div>
    </div>
  );
}

// ---------- tabs ----------

function Dashboard({ violations, students }) {
  const [search, setSearch] = useState('');
  const now = new Date();
  const stats = {
    total: violations.length,
    pending: violations.filter((v) => v.status === 'Pending').length,
    thisMonth: violations.filter((v) => {
      const d = new Date(v.occurredAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    critical: violations.filter((v) => v.severity === 'Critical').length,
  };
  const q = search.trim();
  const history = q ? violations.filter((v) => v.studentNo === q) : [];
  const student = q ? students.find((s) => s.studentNo === q) : null;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          ['TOTAL VIOLATIONS', stats.total],
          ['PENDING CASES', stats.pending],
          ['THIS MONTH', stats.thisMonth],
          ['CRITICAL CASES', stats.critical],
        ].map(([label, value]) => (
          <div key={label} className="bg-gradient-to-br from-red-900 to-yellow-600 text-white p-6 rounded-xl shadow-lg">
            <h4 className="text-sm opacity-90 mb-2">{label}</h4>
            <div className="text-5xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 p-6 rounded-xl">
        <h3 className="text-xl font-bold text-red-900 mb-4">🔍 Student Violation History</h3>
        <div className="mb-4">
          <input type="text" placeholder="Enter Student ID to view history..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-md p-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none" />
        </div>
        {!q ? (
          <div className="text-gray-500 italic text-center p-8">Enter a Student ID to view their violation history</div>
        ) : !student && history.length === 0 ? (
          <div className="bg-yellow-100 p-4 rounded-lg text-yellow-800">No student found with ID {q}.</div>
        ) : (
          <div className="mt-4">
            <div className="bg-blue-100 p-4 rounded-lg mb-4">
              <h4 className="font-bold text-blue-900 mb-2">Student Information</h4>
              <p><strong>ID:</strong> {q}</p>
              {student && <p><strong>Name:</strong> {student.lastName}, {student.firstName} ({student.educationLevel}{student.yearLevel ? ', ' + student.yearLevel : ''})</p>}
              <p><strong>Total Violations:</strong> {history.length}</p>
            </div>
            {history.length === 0 ? (
              <div className="bg-green-100 p-4 rounded-lg text-green-800">Student ID {q} has no violation records.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Violation</th>
                      <th className="p-2 text-left">Severity</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((v) => (
                      <tr key={v.id} className="border-b">
                        <td className="p-2">{toLocalDate(v.occurredAt)}</td>
                        <td className="p-2">{v.violationType}</td>
                        <td className="p-2"><span className={`px-2 py-1 rounded text-xs font-bold ${sevCls(v.severity)}`}>{v.severity}</span></td>
                        <td className="p-2"><span className={`px-2 py-1 rounded text-xs font-bold ${statCls(v.status)}`}>{v.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RecordForm({ students, onSaved, notify, onError }) {
  const blank = { studentNo: '', violationType: VIOLATION_TYPES[0], severity: 'Minor', status: 'Pending', details: '', sanction: '', remarks: '' };
  const [f, setF] = useState({ ...blank, date: toLocalDate(new Date()), time: nowTime() });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const match = students.find((s) => s.studentNo === f.studentNo.trim());

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/violations', {
        method: 'POST',
        body: {
          studentNo: f.studentNo.trim(),
          occurredAt: new Date(`${f.date}T${f.time}`).toISOString(),
          violationType: f.violationType,
          severity: f.severity,
          status: f.status,
          details: f.details,
          sanction: f.sanction,
          remarks: f.remarks,
        },
      });
      notify('Violation record saved successfully!', 'success');
      setF({ ...f, ...blank });
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-gray-50 p-6 rounded-xl">
      <h3 className="text-xl font-bold text-red-900 mb-6">Record New Violation</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" required value={f.date} onChange={set('date')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Time *</label>
          <input type="time" required value={f.time} onChange={set('time')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Student ID *</label>
          <input type="text" required placeholder="Enter Student ID" value={f.studentNo} onChange={set('studentNo')} className={inputCls} />
          {f.studentNo.trim() && (
            <p className={`text-sm mt-1 ${match ? 'text-green-700' : 'text-red-700'}`}>
              {match ? `${match.lastName}, ${match.firstName} (${match.educationLevel})` : 'No student with this ID yet'}
            </p>
          )}
        </div>
        <div>
          <label className={labelCls}>Violation Type *</label>
          <select value={f.violationType} onChange={set('violationType')} className={inputCls}>
            {VIOLATION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Severity *</label>
          <select value={f.severity} onChange={set('severity')} className={inputCls}>
            {SEVERITIES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status *</label>
          <select value={f.status} onChange={set('status')} className={inputCls}>
            {STATUSES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className={labelCls}>Violation Details *</label>
        <textarea rows="3" required maxLength={2000} placeholder="Describe the violation in detail..." value={f.details} onChange={set('details')} className={inputCls}></textarea>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls}>Sanction</label>
          <input type="text" maxLength={100} placeholder="e.g. Verbal Warning" value={f.sanction} onChange={set('sanction')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Remarks/Notes</label>
          <input type="text" maxLength={2000} placeholder="Additional remarks..." value={f.remarks} onChange={set('remarks')} className={inputCls} />
        </div>
      </div>
      <button type="submit" disabled={saving} className={btnCls}>{saving ? 'Saving...' : '💾 Save Violation Record'}</button>
    </form>
  );
}

function ViolationsLog({ violations, canWrite, canDelete, reload, notify, onError }) {
  const changeStatus = async (v, status) => {
    try {
      await api(`/violations/${v.id}`, { method: 'PATCH', body: { status } });
      notify('Status updated', 'success');
      reload();
    } catch (e) {
      onError(e);
    }
  };
  const remove = async (v) => {
    if (!window.confirm(`Delete record ${v.recordNo}? This cannot be undone.`)) return;
    try {
      await api(`/violations/${v.id}`, { method: 'DELETE' });
      notify('Record deleted', 'success');
      reload();
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Violations Log</h2>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition">
            <Printer size={18} /> Print
          </button>
          <button onClick={() => exportCsv(violations)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition">
            <Download size={18} /> Export
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead>
            <tr className={theadCls}>
              {['Record ID', 'Date', 'Student ID', 'Student Name', 'Violation', 'Severity', 'Status', 'Actions'].map((h) => (
                <th key={h} className="p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {violations.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500 italic">No violation records yet.</td></tr>
            )}
            {violations.map((v) => (
              <tr key={v.id} className="border-b hover:bg-gray-50 transition">
                <td className="p-3 font-mono text-sm">{v.recordNo}</td>
                <td className="p-3">{toLocalDate(v.occurredAt)}</td>
                <td className="p-3 font-semibold">{v.studentNo}</td>
                <td className="p-3">{v.studentName}</td>
                <td className="p-3" title={v.details}>{v.violationType}</td>
                <td className="p-3"><span className={`px-3 py-1 rounded-full text-xs font-bold ${sevCls(v.severity)}`}>{v.severity}</span></td>
                <td className="p-3">
                  {canWrite ? (
                    <select value={v.status} onChange={(e) => changeStatus(v, e.target.value)} className="p-1 border-2 border-gray-300 rounded-lg text-sm">
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${statCls(v.status)}`}>{v.status}</span>
                  )}
                </td>
                <td className="p-3">
                  {canDelete && (
                    <button onClick={() => remove(v)} title="Delete record" className="text-red-600 hover:text-red-800 transition">
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportPanel({ reload, notify, onError, onClose }) {
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState([]);
  const [defaultLevel, setDefaultLevel] = useState('');
  const [mode, setMode] = useState('skip');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (dryRun, rows = items, lvl = defaultLevel, m = mode) => {
    setBusy(true);
    try {
      const body = { rows, mode: m, dryRun };
      if (lvl) body.defaultLevel = lvl;
      return await api('/students/import', { method: 'POST', body });
    } finally {
      setBusy(false);
    }
  };

  const check = async (rows, lvl, m) => {
    if (!rows.length) return;
    try {
      setPreview(await run(true, rows, lvl, m));
    } catch (err) {
      setPreview(null);
      onError(err);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setPreview(null);
    setFileName(file.name);
    if (/\.xlsx?$/i.test(file.name)) {
      setItems([]);
      onError(new Error('Please save the Excel file as CSV first: File > Save As > "CSV UTF-8 (Comma delimited)".'));
      return;
    }
    const { items: parsed } = csvToItems(decodeCsvBytes(await file.arrayBuffer()));
    setItems(parsed);
    if (!parsed.length) {
      onError(new Error('That file has no student rows.'));
      return;
    }
    check(parsed, defaultLevel, mode);
  };

  const changeLevel = (v) => { setDefaultLevel(v); check(items, v, mode); };
  const changeMode = (v) => { setMode(v); check(items, defaultLevel, v); };

  const doImport = async () => {
    try {
      const r = await run(false);
      notify(`Import done: ${r.created} added, ${r.updated} updated, ${r.skipped} skipped, ${r.invalidCount} with problems`, 'success');
      setPreview(null);
      setItems([]);
      setFileName('');
      reload();
      if (!r.invalidCount) onClose();
    } catch (err) {
      onError(err);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-master-list-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importable = preview ? preview.create + preview.update : 0;

  return (
    <div className="bg-gray-50 p-6 rounded-xl mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-1">📥 Import Student Master List from a file</h3>
      <p className="text-sm text-gray-600 mb-4">
        In Excel, use File &gt; Save As &gt; <b>CSV UTF-8 (Comma delimited)</b>, then choose that file here. Required columns:
        Student ID, Last Name, First Name, Level (or pick a level below if the whole file is one level). Up to 5,000 students per file.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className={labelCls}>CSV file</label>
          <input type="file" accept=".csv,text/csv,.txt,.xlsx,.xls" onChange={onFile} disabled={busy} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>If a row has no Level, use</label>
          <select value={defaultLevel} onChange={(e) => changeLevel(e.target.value)} className={inputCls}>
            <option value="">(none, the file has a Level column)</option>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Students already in the list</label>
          <select value={mode} onChange={(e) => changeMode(e.target.value)} className={inputCls}>
            <option value="skip">Skip them (keep current details)</option>
            <option value="update">Update them (blank cells never erase data)</option>
          </select>
        </div>
      </div>

      {fileName && <p className="text-sm text-gray-700 mb-2">File: <b>{fileName}</b> · {items.length} rows read</p>}

      {preview && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-3 mb-3">
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-semibold">{preview.create} new</span>
            {mode === 'update'
              ? <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">{preview.update} will be updated</span>
              : <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-800 font-semibold">{preview.skip} already exist (skipped)</span>}
            <span className={`px-3 py-1 rounded-full font-semibold ${preview.invalidCount ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-700'}`}>
              {preview.invalidCount} with problems (not imported)
            </span>
          </div>
          {preview.unmappedColumns && preview.unmappedColumns.length > 0 && (
            <p className="text-sm text-gray-600 mb-2">Ignored columns: {preview.unmappedColumns.join(', ')}</p>
          )}
          {preview.invalidCount > 0 && (
            <div className="overflow-x-auto rounded-lg shadow max-h-64 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className={theadCls}>
                    <th className="p-2 text-left">Row</th>
                    <th className="p-2 text-left">Student ID</th>
                    <th className="p-2 text-left">Problem</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {preview.invalid.map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{p.row}</td>
                      <td className="p-2">{p.studentNo || ''}</td>
                      <td className="p-2">{p.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.invalidCount > preview.invalid.length && (
                <p className="p-2 text-sm text-gray-600 bg-white">Showing the first {preview.invalid.length} problems.</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button onClick={doImport} disabled={busy || !preview || importable === 0} className={btnCls}>
          {busy ? 'Working...' : `✅ Import ${importable || ''} student${importable === 1 ? '' : 's'}`}
        </button>
        <button onClick={downloadTemplate} type="button" className="bg-white border-2 border-gray-300 px-4 py-3 rounded-lg hover:bg-gray-100 transition">
          ⬇️ Download template
        </button>
      </div>
    </div>
  );
}

function DeleteAllStudents({ students, reload, notify, onError }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const withRecords = students.filter((s) => s.violationCount > 0).length;
  const deletable = students.length - withRecords;
  const close = () => { setOpen(false); setText(''); };

  const run = async () => {
    setBusy(true);
    try {
      const r = await api('/students/delete-all', { method: 'POST', body: { confirm: 'DELETE ALL' } });
      notify(`Deleted ${r.deleted} student(s).${r.kept ? ` ${r.kept} kept because they have violation records.` : ''}`, 'success');
      close();
      reload();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-16 pt-6 border-t-2 border-dashed border-red-300">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-red-700 border-2 border-red-300 px-4 py-2 rounded-lg hover:bg-red-50 transition text-sm">
          🗑️ Delete All Students...
        </button>
      ) : (
        <div className="max-w-2xl bg-red-50 border-2 border-red-400 rounded-xl p-6">
          <h3 className="text-lg font-bold text-red-800 mb-3">⚠️ Delete the entire Student Master List?</h3>
          {deletable === 0 ? (
            <p className="mb-4 text-gray-800">Nothing can be deleted: every student here has violation records. Delete those records in the Violations Log first.</p>
          ) : (
            <>
              <p className="mb-2 text-gray-800">
                This will permanently delete <strong>{deletable}</strong> student(s). It <strong>cannot be undone</strong>.
              </p>
              {withRecords > 0 && (
                <p className="mb-2 text-gray-800">
                  <strong>{withRecords}</strong> student(s) who have violation records will be <strong>kept</strong>, so discipline history is never lost.
                </p>
              )}
              <p className="mb-4 text-sm text-gray-600">Tip: ask IT for a database backup first if this list is not easy to import again.</p>
              <label className={labelCls}>Type <span className="font-mono font-bold">DELETE ALL</span> to confirm</label>
              <input
                type="text"
                autoFocus
                autoComplete="off"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={inputCls + ' mb-4'}
              />
            </>
          )}
          <div className="flex gap-3">
            {deletable > 0 && (
              <button
                onClick={run}
                disabled={text !== 'DELETE ALL' || busy}
                className="bg-red-700 text-white font-bold px-5 py-2 rounded-lg hover:bg-red-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Deleting...' : `Delete ${deletable} student(s)`}
              </button>
            )}
            <button onClick={close} disabled={busy} className="px-5 py-2 rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentsTab({ students, canWrite, reload, notify, onError }) {
  const blank = { studentNo: '', lastName: '', firstName: '', middleName: '', educationLevel: 'College', yearLevel: '', course: '', section: '', guardianName: '', guardianContact: '' };
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/students', { method: 'POST', body: f });
      notify('Student added', 'success');
      setF(blank);
      setOpen(false);
      reload();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (s.violationCount > 0) {
      onError(new Error(`${s.lastName}, ${s.firstName} has ${s.violationCount} violation record(s). Delete those records in the Violations Log first.`));
      return;
    }
    if (!window.confirm(`Delete ${s.lastName}, ${s.firstName} (${s.studentNo}) from the Student Master List? This cannot be undone.`)) return;
    try {
      await api(`/students/${s.id}`, { method: 'DELETE' });
      notify('Student deleted', 'success');
      reload();
    } catch (err) {
      onError(err);
    }
  };

  const q = filter.trim().toLowerCase();
  const shown = q
    ? students.filter((s) => [s.studentNo, s.lastName, s.firstName, s.middleName, s.course, s.section].some((v) => String(v || '').toLowerCase().includes(q)))
    : students;
  const visible = shown.slice(0, 200); // keeps the page fast with thousands of students

  const field = (key, label, required, props = {}) => (
    <div key={key}>
      <label className={labelCls}>{label}{required ? ' *' : ''}</label>
      <input type="text" required={required} maxLength={120} value={f[key]} onChange={set(key)} className={inputCls} {...props} />
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Student Master List</h2>
        {canWrite && (
          <div className="flex gap-2">
            <button onClick={() => setImportOpen(!importOpen)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              {importOpen ? 'Close Import' : '📥 Import from File'}
            </button>
            <button onClick={() => setOpen(!open)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
              {open ? 'Cancel' : '➕ Add Student'}
            </button>
          </div>
        )}
      </div>

      {importOpen && canWrite && (
        <ImportPanel reload={reload} notify={notify} onError={onError} onClose={() => setImportOpen(false)} />
      )}

      {open && (
        <form onSubmit={submit} className="bg-gray-50 p-6 rounded-xl mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {field('studentNo', 'Student ID', true)}
            {field('lastName', 'Last Name', true)}
            {field('firstName', 'First Name', true)}
            {field('middleName', 'Middle Name', false)}
            <div>
              <label className={labelCls}>Education Level *</label>
              <select value={f.educationLevel} onChange={set('educationLevel')} className={inputCls}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            {field('yearLevel', 'Year / Grade Level', false, { placeholder: 'e.g. 1st Year or Grade 4' })}
            {field('course', 'Course / Strand', false)}
            {field('section', 'Section', false)}
            {field('guardianName', 'Guardian Name', false)}
            {field('guardianContact', 'Guardian Contact', false)}
          </div>
          <button type="submit" disabled={saving} className={btnCls}>{saving ? 'Saving...' : '💾 Save Student'}</button>
        </form>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by Student ID, name, course or section..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md p-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none"
        />
        <span className="ml-3 text-sm text-gray-600">
          {shown.length > visible.length ? `Showing first ${visible.length} of ${shown.length}. Type to narrow the list.` : `${shown.length} student(s)`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead>
            <tr className={theadCls}>
              {['Student ID', 'Last Name', 'First Name', 'Middle Name', 'Level', 'Year Level', 'Course', 'Section', 'Guardian Contact', 'Violations', ...(canWrite ? ['Actions'] : [])].map((h) => (
                <th key={h} className="p-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {shown.length === 0 && (
              <tr><td colSpan={11} className="p-6 text-center text-gray-500 italic">{students.length === 0 ? 'No students yet.' : 'No students match your search.'}</td></tr>
            )}
            {visible.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50 transition">
                <td className="p-3 font-bold text-red-900">{s.studentNo}</td>
                <td className="p-3">{s.lastName}</td>
                <td className="p-3">{s.firstName}</td>
                <td className="p-3">{s.middleName}</td>
                <td className="p-3">{s.educationLevel}</td>
                <td className="p-3">{s.yearLevel}</td>
                <td className="p-3">{s.course}</td>
                <td className="p-3">{s.section}</td>
                <td className="p-3">{s.guardianContact}</td>
                <td className="p-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-900 font-bold rounded-full">{s.violationCount}</span>
                </td>
                {canWrite && (
                  <td className="p-3">
                    <button
                      onClick={() => remove(s)}
                      title={s.violationCount > 0 ? 'Has violation records' : 'Delete student'}
                      className={`p-2 rounded-lg transition ${s.violationCount > 0 ? 'text-gray-400 hover:bg-gray-100' : 'text-red-700 hover:bg-red-100'}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canWrite && students.length > 0 && (
        <DeleteAllStudents students={students} reload={reload} notify={notify} onError={onError} />
      )}
    </div>
  );
}

function UsersTab({ currentUser, notify, onError, usernameOnly }) {
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({ username: '', fullName: '', tempPassword: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = useCallback(async () => {
    try {
      setUsers((await api('/users')).users);
    } catch (e) {
      onError(e);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/users', { method: 'POST', body: f });
      notify(usernameOnly ? 'User created' : 'User created. They must change the password at first login.', 'success');
      setF({ ...f, username: '', fullName: '', tempPassword: '' });
      load();
    } catch (err) {
      onError(err);
    }
  };
  const patch = async (u, body, message) => {
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body });
      notify(message, 'success');
      load();
    } catch (err) {
      onError(err);
    }
  };
  const reset = async (u) => {
    const pw = window.prompt(`Temporary password for ${u.username} (at least 12 characters). They must change it at next login.`);
    if (!pw) return;
    try {
      await api(`/users/${u.id}/reset-password`, { method: 'POST', body: { tempPassword: pw } });
      notify('Password reset', 'success');
      load();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">User Accounts</h2>
      <form onSubmit={create} className="bg-gray-50 p-6 rounded-xl mb-6">
        <h3 className="text-lg font-bold text-red-900 mb-4">Add a user</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={labelCls}>Username *</label>
            <input type="text" required autoComplete="off" value={f.username} onChange={set('username')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Full name *</label>
            <input type="text" required value={f.fullName} onChange={set('fullName')} className={inputCls} />
          </div>
          {!usernameOnly && (
            <div>
              <label className={labelCls}>Temporary password *</label>
              <input type="text" required minLength={12} autoComplete="off" value={f.tempPassword} onChange={set('tempPassword')} className={inputCls} />
            </div>
          )}
        </div>
        <button type="submit" className={btnCls}>➕ Create User</button>
        <p className="text-sm text-gray-600 mt-3">Every account has full access, so only create accounts for OSAS personnel.</p>
      </form>

      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead>
            <tr className={theadCls}>
              {['Username', 'Full Name', 'Status', 'Actions'].map((h) => <th key={h} className="p-3 text-left">{h}</th>)}
            </tr>
          </thead>
          <tbody className="bg-white">
            {users.map((u) => {
              const self = u.id === currentUser.id;
              return (
                <tr key={u.id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-3 font-semibold">{u.username}{self ? ' (you)' : ''}</td>
                  <td className="p-3">{u.fullName}</td>
                  <td className="p-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.active ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>{u.active ? 'Active' : 'Disabled'}</span>
                    {u.role === 'viewer' && <span className="ml-2 text-xs text-red-700">old read-only account (cannot sign in)</span>}
                    {u.mustChangePassword && <span className="ml-2 text-xs text-gray-600">must change password</span>}
                  </td>
                  <td className="p-3 space-x-3 whitespace-nowrap">
                    {!self && (
                      <button onClick={() => patch(u, { active: !u.active }, u.active ? 'User disabled' : 'User enabled')} className="text-blue-700 underline text-sm">
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                    {!usernameOnly && <button onClick={() => reset(u)} className="text-blue-700 underline text-sm">Reset password</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab({ onError }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    api('/audit?limit=200').then((d) => setEntries(d.entries)).catch(onError);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Audit Log (latest 200)</h2>
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={theadCls}>
              {['When', 'User', 'Action', 'Entity', 'ID', 'Details', 'IP'].map((h) => <th key={h} className="p-3 text-left">{h}</th>)}
            </tr>
          </thead>
          <tbody className="bg-white">
            {entries.map((a) => (
              <tr key={a.id} className="border-b hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                <td className="p-3">{a.username}</td>
                <td className="p-3 font-mono">{a.action}</td>
                <td className="p-3">{a.entity}</td>
                <td className="p-3">{a.entityId}</td>
                <td className="p-3">{a.details}</td>
                <td className="p-3">{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- main component ----------

const SSCInfractionsSystem = () => {
  const [auth, setAuth] = useState({ status: 'loading', user: null, mustChange: false });
  const [usernameOnly, setUsernameOnly] = useState(false);
  useEffect(() => {
    api('/auth/config').then((c) => setUsernameOnly(!!c.usernameOnly)).catch(() => {});
  }, []);
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [violations, setViolations] = useState([]);
  const [showAlert, setShowAlert] = useState({ show: false, message: '', type: '' });

  const displayAlert = (message, type) => {
    setShowAlert({ show: true, message, type });
    setTimeout(() => setShowAlert({ show: false, message: '', type: '' }), 3500);
  };

  const handleError = (e) => {
    if (e.status === 401) {
      setAuth({ status: 'out', user: null, mustChange: false });
      setLoginError('Your session has ended. Please sign in again.');
    } else if (e.status === 403 && /change your password/i.test(e.message)) {
      setAuth((a) => ({ ...a, mustChange: true }));
    } else {
      displayAlert(e.message || 'Something went wrong', 'error');
    }
  };

  useEffect(() => {
    api('/auth/me')
      .then(({ user }) => setAuth({ status: 'in', user, mustChange: user.mustChangePassword }))
      .catch(() => setAuth({ status: 'out', user: null, mustChange: false }));
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([api('/students'), api('/violations')]);
      setStudents(s.students);
      setViolations(v.violations);
    } catch (e) {
      handleError(e);
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'in' && !auth.mustChange) loadData();
  }, [auth.status, auth.mustChange, loadData]);

  const handleLogin = async (username, password) => {
    setBusy(true);
    setLoginError('');
    try {
      const data = await api('/auth/login', { method: 'POST', body: { username, password } });
      setAuth({ status: 'in', user: data.user, mustChange: data.mustChangePassword });
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (currentPassword, newPassword) => {
    await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    setAuth((a) => ({ ...a, mustChange: false }));
    displayAlert('Password changed.', 'success');
  };

  const handleLogout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* already logged out */
    }
    setAuth({ status: 'out', user: null, mustChange: false });
    setStudents([]);
    setViolations([]);
    setActiveTab('dashboard');
    setLoginError('');
  };

  const user = auth.user;
  // One level of access: anyone signed in can do everything.
  const canWrite = !!user;
  const isAdmin = !!user;

  let screen;
  if (auth.status === 'loading') {
    screen = <div className="min-h-screen bg-gradient-to-br from-red-900 to-yellow-600 flex items-center justify-center text-white text-lg">Loading...</div>;
  } else if (auth.status === 'out') {
    screen = <LoginScreen onLogin={handleLogin} error={loginError} busy={busy} usernameOnly={usernameOnly} />;
  } else if (auth.mustChange) {
    screen = <ChangePasswordScreen user={user} onSubmit={handleChangePassword} onLogout={handleLogout} />;
  } else {
    const tabs = [
      { id: 'dashboard', label: '📊 Dashboard' },
      ...(canWrite ? [{ id: 'violations', label: '⚠️ Record Violation' }] : []),
      { id: 'log', label: '📜 Violations Log' },
      { id: 'students', label: '👥 Student Master List' },
      ...(isAdmin ? [{ id: 'users', label: '👤 Users' }, { id: 'audit', label: '🧾 Audit Log' }] : []),
    ];
    screen = (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-yellow-600 p-4">
        <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-900 to-yellow-600 text-white p-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <SchoolLogo />
                <div>
                  <h1 className="text-3xl font-bold mb-1">📋 Student Infractions Tracking System</h1>
                  <p className="text-sm font-medium opacity-95">San Sebastian College-Recoletos, Manila</p>
                  <p className="text-sm opacity-90">Office of Student Affairs and Services</p>
                  <p className="text-xs mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Connected to server • Changes are saved to the database
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{user.fullName}</div>
                <div className="mb-2"></div>
                <button onClick={handleLogout} className="bg-white/20 border-2 border-white text-white px-4 py-2 rounded-lg font-semibold hover:bg-white hover:text-red-900 transition">
                  Logout
                </button>
              </div>
            </div>
          </div>

          <div className="flex bg-gray-100 border-b-2 border-gray-300 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-semibold transition whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-white text-red-900 border-b-4 border-red-900' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'dashboard' && <Dashboard violations={violations} students={students} />}
            {activeTab === 'violations' && canWrite && (
              <RecordForm students={students} onSaved={loadData} notify={displayAlert} onError={handleError} />
            )}
            {activeTab === 'log' && (
              <ViolationsLog violations={violations} canWrite={canWrite} canDelete={isAdmin} reload={loadData} notify={displayAlert} onError={handleError} />
            )}
            {activeTab === 'students' && (
              <StudentsTab students={students} canWrite={canWrite} reload={loadData} notify={displayAlert} onError={handleError} />
            )}
            {activeTab === 'users' && isAdmin && <UsersTab currentUser={user} notify={displayAlert} onError={handleError} usernameOnly={usernameOnly} />}
            {activeTab === 'audit' && isAdmin && <AuditTab onError={handleError} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {screen}
      {showAlert.show && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`p-4 rounded-lg shadow-lg ${showAlert.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {showAlert.message}
          </div>
        </div>
      )}
    </>
  );
};

export default SSCInfractionsSystem;
