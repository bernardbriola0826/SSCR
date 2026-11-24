import React, { useState, useEffect } from 'react';
import { Search, Plus, Download, Printer, Edit, Trash2, X, Check, AlertCircle } from 'lucide-react';

const SSCInfractionsSystem = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [violations, setViolations] = useState([]);
  const [showAlert, setShowAlert] = useState({ show: false, message: '', type: '' });
  const [searchStudent, setSearchStudent] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  useEffect(() => {
    const sampleStudents = [
      { id: '2024-001', lastName: 'Dela Cruz', firstName: 'Juan', middleName: 'Santos', yearLevel: '1st Year', course: 'BSIT', grade: '1st Year', section: 'A', contact: '09171234567', guardian: 'Maria Dela Cruz' },
      { id: '2024-002', lastName: 'Santos', firstName: 'Maria', middleName: 'Garcia', yearLevel: '2nd Year', course: 'BSBA', grade: '2nd Year', section: 'B', contact: '09187654321', guardian: 'Pedro Santos' },
      { id: '2024-003', lastName: 'Reyes', firstName: 'Pedro', middleName: 'Lopez', yearLevel: '3rd Year', course: 'BSCS', grade: '3rd Year', section: 'A', contact: '09191234567', guardian: 'Ana Reyes' }
    ];
    setStudents(sampleStudents);

    const sampleViolations = [
      {
        id: 1,
        recordId: '20241022-001',
        date: '2024-10-22',
        time: '08:30',
        studentId: '2024-001',
        studentName: 'Dela Cruz, Juan',
        yearLevel: '1st Year',
        course: 'BSIT',
        violationType: 'Tardiness',
        violationDetails: 'Student arrived 30 minutes late without valid excuse',
        severity: 'Minor',
        sanction: 'Verbal Warning',
        status: 'Resolved',
        recordedBy: 'Admin',
        remarks: 'First offense'
      },
      {
        id: 2,
        recordId: '20241020-002',
        date: '2024-10-20',
        time: '14:15',
        studentId: '2024-002',
        studentName: 'Santos, Maria',
        yearLevel: '2nd Year',
        course: 'BSBA',
        violationType: 'Uniform Violation',
        violationDetails: 'Not wearing proper school ID',
        severity: 'Minor',
        sanction: 'Written Warning',
        status: 'Pending',
        recordedBy: 'Admin',
        remarks: 'Second offense this month'
      }
    ];
    setViolations(sampleViolations);
  }, []);

  const handleLogin = () => {
    if (loginForm.username === 'admin' && loginForm.password === 'admin123') {
      setCurrentUser({ username: 'admin', fullName: 'Administrator' });
      setIsLoggedIn(true);
      displayAlert('Login successful!', 'success');
    } else {
      displayAlert('Invalid username or password', 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const displayAlert = (message, type) => {
    setShowAlert({ show: true, message, type });
    setTimeout(() => setShowAlert({ show: false, message: '', type: '' }), 3000);
  };

  const stats = {
    total: violations.length,
    pending: violations.filter(v => v.status === 'Pending').length,
    thisMonth: violations.filter(v => {
      const vDate = new Date(v.date);
      const now = new Date();
      return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
    }).length,
    critical: violations.filter(v => v.severity === 'Critical').length
  };

  const SchoolLogo = () => (
    <svg className="w-20 h-20 bg-white rounded-full p-2 shadow-lg" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="95" fill="#8B0000" stroke="#DAA520" strokeWidth="3"/>
      <circle cx="100" cy="100" r="80" fill="white"/>
      <text x="100" y="80" fontFamily="serif" fontSize="32" fontWeight="bold" fill="#8B0000" textAnchor="middle">SSC</text>
      <text x="100" y="110" fontFamily="serif" fontSize="16" fontWeight="bold" fill="#8B0000" textAnchor="middle">RECOLETOS</text>
      <path d="M100 35 L95 40 Q85 45 85 55 Q85 65 100 75 Q115 65 115 55 Q115 45 105 40 Z" fill="#DC143C"/>
      <path d="M75 130 L75 145 Q75 150 100 148 Q125 150 125 145 L125 130 Q125 125 100 127 Q75 125 75 130 Z" fill="#8B0000"/>
      <line x1="100" y1="130" x2="100" y2="148" stroke="white" strokeWidth="2"/>
      <text x="100" y="170" fontFamily="serif" fontSize="12" fontWeight="bold" fill="#8B0000" textAnchor="middle">MANILA • 1941</text>
      <path d="M40 100 L35 95 L40 90 L45 95 Z" fill="#DAA520"/>
      <path d="M160 100 L155 95 L160 90 L165 95 Z" fill="#DAA520"/>
    </svg>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-yellow-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-fadeIn">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-red-900 mb-2">🔐 Sign In</h1>
            <p className="font-semibold text-lg text-red-900">San Sebastian College-Recoletos, Manila</p>
            <p className="text-gray-600 font-medium">Office of Student Affairs and Services</p>
            <p className="text-gray-700 mt-2">Student Infractions Tracking System</p>
          </div>
          
          {showAlert.show && (
            <div className={`mb-4 p-3 rounded ${showAlert.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {showAlert.message}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block font-semibold mb-2 text-gray-700">Username</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2 text-gray-700">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none"
              />
            </div>
            <button 
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-red-900 to-yellow-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition transform hover:-translate-y-1"
            >
              Sign In
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm">
            <strong>Default Login:</strong><br/>
            Username: <code className="bg-white px-2 py-1 rounded">admin</code><br/>
            Password: <code className="bg-white px-2 py-1 rounded">admin123</code>
          </div>
        </div>
      </div>
    );
  }

  return (
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
                  Real-time Updates • Auto-Save Enabled
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{currentUser?.fullName}</div>
              <div className="text-sm opacity-80 mb-2">Logged In</div>
              <button 
                onClick={handleLogout}
                className="bg-white/20 border-2 border-white text-white px-4 py-2 rounded-lg font-semibold hover:bg-white hover:text-red-900 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="flex bg-gray-100 border-b-2 border-gray-300 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'violations', label: '⚠️ Record Violation' },
            { id: 'log', label: '📜 Violations Log' },
            { id: 'students', label: '👥 Student Master List' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 font-semibold transition whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-white text-red-900 border-b-4 border-red-900' 
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-red-900 to-yellow-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition">
                  <h4 className="text-sm opacity-90 mb-2">TOTAL VIOLATIONS</h4>
                  <div className="text-5xl font-bold">{stats.total}</div>
                </div>
                <div className="bg-gradient-to-br from-red-900 to-yellow-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition">
                  <h4 className="text-sm opacity-90 mb-2">PENDING CASES</h4>
                  <div className="text-5xl font-bold">{stats.pending}</div>
                </div>
                <div className="bg-gradient-to-br from-red-900 to-yellow-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition">
                  <h4 className="text-sm opacity-90 mb-2">THIS MONTH</h4>
                  <div className="text-5xl font-bold">{stats.thisMonth}</div>
                </div>
                <div className="bg-gradient-to-br from-red-900 to-yellow-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition">
                  <h4 className="text-sm opacity-90 mb-2">CRITICAL CASES</h4>
                  <div className="text-5xl font-bold">{stats.critical}</div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-xl font-bold text-red-900 mb-4">🔍 Student Violation History</h3>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Enter Student ID to view history..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="w-full max-w-md p-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none"
                  />
                </div>
                {searchStudent ? (
                  violations.filter(v => v.studentId === searchStudent).length > 0 ? (
                    <div className="mt-4">
                      <div className="bg-blue-100 p-4 rounded-lg mb-4">
                        <h4 className="font-bold text-blue-900 mb-2">Student Information</h4>
                        <p><strong>ID:</strong> {searchStudent}</p>
                        <p><strong>Total Violations:</strong> {violations.filter(v => v.studentId === searchStudent).length}</p>
                      </div>
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
                            {violations.filter(v => v.studentId === searchStudent).map(v => (
                              <tr key={v.id} className="border-b">
                                <td className="p-2">{v.date}</td>
                                <td className="p-2">{v.violationType}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    v.severity === 'Minor' ? 'bg-yellow-200' : v.severity === 'Major' ? 'bg-orange-200' : 'bg-red-200'
                                  }`}>
                                    {v.severity}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    v.status === 'Resolved' ? 'bg-green-200' : 'bg-yellow-200'
                                  }`}>
                                    {v.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-100 p-4 rounded-lg text-green-800">
                      Student ID {searchStudent} has no violation records.
                    </div>
                  )
                ) : (
                  <div className="text-gray-500 italic text-center p-8">
                    Enter a Student ID to view their violation history
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'violations' && (
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-xl font-bold text-red-900 mb-6">Record New Violation</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block font-semibold mb-2 text-gray-700">Date *</label>
                  <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold mb-2 text-gray-700">Time *</label>
                  <input type="time" className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold mb-2 text-gray-700">Student ID *</label>
                  <input type="text" placeholder="Enter Student ID" className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold mb-2 text-gray-700">Violation Type *</label>
                  <select className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none">
                    <option>Select violation type...</option>
                    <option>Tardiness</option>
                    <option>Uniform Violation</option>
                    <option>Behavioral Misconduct</option>
                    <option>Academic Dishonesty</option>
                    <option>Bullying/Harassment</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-2 text-gray-700">Severity *</label>
                  <select className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none">
                    <option>Minor</option>
                    <option>Major</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-2 text-gray-700">Status *</label>
                  <select className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none">
                    <option>Pending</option>
                    <option>Ongoing</option>
                    <option>Resolved</option>
                    <option>Dismissed</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-2 text-gray-700">Violation Details *</label>
                <textarea rows="3" placeholder="Describe the violation in detail..." className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none"></textarea>
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-2 text-gray-700">Remarks/Notes</label>
                <textarea rows="2" placeholder="Additional remarks..." className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none"></textarea>
              </div>
              <button 
                onClick={() => displayAlert('Violation record saved successfully!', 'success')}
                className="bg-gradient-to-r from-red-900 to-yellow-600 text-white font-bold px-6 py-3 rounded-lg hover:shadow-lg transition transform hover:-translate-y-1"
              >
                💾 Save Violation Record
              </button>
            </div>
          )}

          {activeTab === 'log' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Violations Log</h2>
                <div className="flex gap-2">
                  <button className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition">
                    <Printer size={18} /> Print
                  </button>
                  <button className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition">
                    <Download size={18} /> Export
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-lg shadow">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-red-900 to-yellow-600 text-white">
                      <th className="p-3 text-left">Record ID</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Student ID</th>
                      <th className="p-3 text-left">Student Name</th>
                      <th className="p-3 text-left">Violation</th>
                      <th className="p-3 text-left">Severity</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {violations.map((v) => (
                      <tr key={v.id} className="border-b hover:bg-gray-50 transition">
                        <td className="p-3 font-mono text-sm">{v.recordId}</td>
                        <td className="p-3">{v.date}</td>
                        <td className="p-3 font-semibold">{v.studentId}</td>
                        <td className="p-3">{v.studentName}</td>
                        <td className="p-3">{v.violationType}</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            v.severity === 'Minor' ? 'bg-yellow-200 text-yellow-800' :
                            v.severity === 'Major' ? 'bg-orange-300 text-orange-900' :
                            'bg-red-500 text-white'
                          }`}>
                            {v.severity}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            v.status === 'Resolved' ? 'bg-green-500 text-white' :
                            v.status === 'Pending' ? 'bg-yellow-400 text-yellow-900' :
                            'bg-blue-500 text-white'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <button className="text-red-600 hover:text-red-800 transition">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Student Master List</h2>
              
              <div className="overflow-x-auto rounded-lg shadow">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-red-900 to-yellow-600 text-white">
                      <th className="p-3 text-left">Student ID</th>
                      <th className="p-3 text-left">Last Name</th>
                      <th className="p-3 text-left">First Name</th>
                      <th className="p-3 text-left">Year Level</th>
                      <th className="p-3 text-left">Course</th>
                      <th className="p-3 text-left">Section</th>
                      <th className="p-3 text-left">Contact</th>
                      <th className="p-3 text-left">Violations</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {students.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-gray-50 transition">
                        <td className="p-3 font-bold text-red-900">{s.id}</td>
                        <td className="p-3">{s.lastName}</td>
                        <td className="p-3">{s.firstName}</td>
                        <td className="p-3">{s.yearLevel}</td>
                        <td className="p-3">{s.course}</td>
                        <td className="p-3">{s.section}</td>
                        <td className="p-3">{s.contact}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-900 font-bold rounded-full">
                            {violations.filter(v => v.studentId === s.id).length}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAlert.show && (
        <div className="fixed bottom-4 right-4 z-50 animate-fadeIn">
          <div className={`p-4 rounded-lg shadow-lg ${
            showAlert.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {showAlert.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default SSCInfractionsSystem;