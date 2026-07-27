import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function TeacherDashboard() {
  const { user, logout, saveLocation, API } = useAuth();
  const navigate = useNavigate();

  // ── GPS State ──────────────────────────────
  const [location, setLocation] = useState(null);
  const [geoStatus, setGeoStatus] = useState('Acquiring GPS...');
  const [locationSaved, setLocationSaved] = useState(false);

  // ── QR Generation State ────────────────────
  const [subject, setSubject] = useState('');
  const [qrCode, setQrCode] = useState(null);
  const [session, setSession] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const timerRef = useRef(null);

  // ── Session History State ──────────────────
  const [sessions, setSessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── End Session State ──────────────────────
  const [endingSession, setEndingSession] = useState(false);

  // ── Session Details Modal State ────────────
  const [selectedSessionForDetails, setSelectedSessionForDetails] = useState(null);
  const [sessionDetails, setSessionDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // ══════════════════════════════════════════
  //  GPS Auto-Fetch Once on Mount
  // ══════════════════════════════════════════
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('❌ Geolocation not supported');
      return;
    }

    // Try to get high accuracy position — only once on mount
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        setGeoStatus('✅ GPS locked — classroom location set');
        setLocationSaved(true);

        // Auto-save to teacher's profile
        try {
          await saveLocation(lat, lng);
          console.log('📍 Classroom GPS saved to profile:', lat, lng);
        } catch (err) {
          console.warn('Could not auto-save GPS:', err.message);
        }
      },
      (err) => {
        setGeoStatus(`❌ GPS error: ${err.message}. Students can still use env defaults.`);
        console.warn('GPS error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
    // Only run once on mount — `saveLocation` is stable in behavior
    // eslint-disable-next-line
  }, []);

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-clear interval when countdown reaches 0
  useEffect(() => {
    if (countdown <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [countdown]);

  // ══════════════════════════════════════════
  //  Generate QR Session
  // ══════════════════════════════════════════
  const generateQR = async (e) => {
    e.preventDefault();
    if (!subject.trim()) return;

    setLoading(true);
    setError('');
    setMessage('');
    setQrCode(null);
    setSession(null);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await API.post('/qr/generate', { subject: subject.trim() });
      setQrCode(res.data.qr);
      setSession(res.data.session);
      setCountdown(res.data.session.ttlSeconds);

      // Start countdown timer
      timerRef.current = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);

      setMessage(`✅ QR generated for "${res.data.session.subject}"`);

      // Refresh session history
      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  // ══════════════════════════════════════════
  //  End Session Manually (from active QR card)
  // ══════════════════════════════════════════
  const endSession = async () => {
    if (!session) return;
    setEndingSession(true);
    setError('');

    try {
      const res = await API.put('/qr/end', { sessionId: session.sessionId });
      setMessage(res.data.message || 'Session ended');
      // Clear the QR display
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(0);
      setSession((prev) => prev ? { ...prev, ended: true } : null);
      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to end session');
    } finally {
      setEndingSession(false);
    }
  };

  // ══════════════════════════════════════════
  //  End Session by session ID (from history table)
  // ══════════════════════════════════════════
  const endSessionById = async (sessionId, dbId) => {
    setEndingSession(true);
    setError('');

    try {
      const res = await API.put('/qr/end', { sessionId });
      setMessage(res.data.message || 'Session ended');

      // Update sessions list immediately
      setSessions((prev) =>
        prev.map((s) => (s.id === dbId ? { ...s, isActive: false } : s))
      );

      // If this was the currently displayed session, clear it
      if (session && session.sessionId === sessionId) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(0);
        setSession((prev) => (prev ? { ...prev, ended: true } : null));
      }

      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to end session');
    } finally {
      setEndingSession(false);
    }
  };

  // ══════════════════════════════════════════
  //  Fetch Session History
  // ══════════════════════════════════════════
  const fetchSessions = async () => {
    setHistoryLoading(true);
    try {
      const res = await API.get('/qr/sessions');
      setSessions(res.data.sessions || []);
    } catch (err) {
      console.warn('Failed to fetch session history:', err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ══════════════════════════════════════════
  //  Fetch Session Details (for modal)
  // ══════════════════════════════════════════
  const fetchSessionDetails = async (dbId, subject, date) => {
    setSelectedSessionForDetails({ id: dbId, subject, date });
    setDetailsLoading(true);
    setDetailsError('');
    setSessionDetails([]);

    try {
      const res = await API.get(`/attendance/session/${dbId}`);
      setSessionDetails(res.data.attendance || []);
    } catch (err) {
      setDetailsError(err.response?.data?.message || 'Failed to fetch details');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Load session history on mount
  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line
  }, []);

  // ══════════════════════════════════════════
  //  Helpers
  // ══════════════════════════════════════════
  const handleLogout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    logout();
    navigate('/login');
  };

  const isSessionActive = session && !session.ended && countdown > 0;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ══════════════════════════════════════════
  //  Styles
  // ══════════════════════════════════════════
  const s = styles;

  return (
    <div style={s.container}>
      {/* ── Animations styles ─────────────────── */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* ── Header ────────────────────────────── */}
      <div style={s.header}>
        <div>
          <h1 style={{ margin: 0 }}>📚 Teacher Dashboard</h1>
          <span style={s.roleBadge}>{user?.role}</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.userInfo}>{user?.name}</span>
          <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
        </div>
      </div>

      <div style={s.content}>
        {/* ── GPS Status Card ──────────────────── */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>📍 Classroom Location</h2>
          <p style={{ color: locationSaved ? '#10b981' : '#ff6b6b' }}>
            {geoStatus}
          </p>
          {location && (
            <p style={{ fontSize: '0.8rem', color: '#888' }}>
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              {user?.classroomLocation && ' ✓ Saved to profile'}
            </p>
          )}
          {!locationSaved && (
            <p style={{ fontSize: '0.8rem', color: '#aaa' }}>
              ⚠️ GPS will be used for student geo-verification. Falling back to env defaults if unavailable.
            </p>
          )}
        </div>

        {/* ── Messages / Errors ────────────────── */}
        {message && <div style={s.successBox} onClick={() => setMessage('')}>{message}</div>}
        {error && <div style={s.errorBox} onClick={() => setError('')}>{error}</div>}

        {/* ── Generate QR Form ─────────────────── */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>🎯 Generate QR Code</h2>
          <p style={{ color: '#aaa', marginBottom: '12px', fontSize: '0.9rem' }}>
            Students scan this QR to mark attendance with GPS verification
          </p>
          <form onSubmit={generateQR} style={s.form}>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject name (e.g. Mathematics)"
              style={s.input}
              required
            />
            <button type="submit" disabled={loading} style={s.primaryBtn}>
              {loading ? '⏳ Generating...' : '📷 Generate QR Code'}
            </button>
          </form>
        </div>

        {/* ── QR Display (when active) ─────────── */}
        {qrCode && session && (
          <div style={{ ...s.card, textAlign: 'center' }}>
            <div style={s.qrHeader}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>📱 Active Session</h2>
              <span style={isSessionActive ? s.liveBadge : s.endedBadge}>
                {isSessionActive ? '🔴 LIVE' : '⏹️ ENDED'}
              </span>
            </div>

            {/* QR Image */}
            <div style={s.qrWrapper}>
              <img
                src={qrCode}
                alt="Attendance QR Code"
                style={s.qrImage}
              />
            </div>

            {/* Session Info */}
            <p style={{ margin: '12px 0 4px', fontSize: '1.1rem', fontWeight: 600 }}>
              {session.subject}
            </p>
            {isSessionActive && (
              <p style={{ margin: '4px 0', color: '#aaa' }}>
                Expires in{' '}
                <strong style={{ color: countdown < 10 ? '#ff6b6b' : '#6c63ff', fontSize: '1.4rem' }}>
                  {countdown}s
                </strong>
              </p>
            )}
            {!isSessionActive && (
              <p style={{ margin: '4px 0', color: '#ff6b6b' }}>
                ⏰ Session expired
              </p>
            )}

            {/* End Session Button */}
            {isSessionActive && (
              <button
                onClick={endSession}
                disabled={endingSession}
                style={s.endBtn}
              >
                {endingSession ? '⏳ Ending...' : '⏹️ End Session'}
              </button>
            )}
          </div>
        )}

        {/* ── Attendance Overview Chart ─────────── */}
        {sessions.length > 0 && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>📊 Attendance Overview</h2>
            <div style={{ width: '100%', height: 300, marginTop: '20px' }}>
              <ResponsiveContainer>
                <BarChart
                  data={[...sessions].reverse().map(sess => ({
                    name: sess.subject,
                    date: new Date(sess.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    time: new Date(sess.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
                    Students: sess.studentCount,
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#aaa" 
                    tick={{ fill: '#aaa', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  />
                  <YAxis 
                    stroke="#aaa" 
                    tick={{ fill: '#aaa', fontSize: 11 }} 
                    allowDecimals={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#6c63ff', fontWeight: 'bold' }}
                    labelStyle={{ color: '#aaa', marginBottom: '4px', fontSize: '0.9rem' }}
                    formatter={(value) => [value, 'Students']}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        return `${label} - ${payload[0].payload.date} ${payload[0].payload.time}`;
                      }
                      return label;
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="Students" fill="#6c63ff" radius={[6, 6, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Session History ──────────────────── */}
        <div style={s.card}>
          <div style={s.historyHeader}>
            <h2 style={{ ...s.cardTitle, margin: 0 }}>📋 Recent Sessions</h2>
            <button onClick={fetchSessions} disabled={historyLoading} style={s.refreshBtn}>
              {historyLoading ? '↻' : '↻ Refresh'}
            </button>
          </div>

          {sessions.length === 0 ? (
            <p style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>
              No sessions yet. Generate your first QR above!
            </p>
          ) : (
            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Subject</th>
                    <th style={s.th}>Time</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Students</th>
                    <th style={s.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sess) => (
                    <tr key={sess.id} style={s.tr}>
                      <td style={s.td}>{sess.subject}</td>
                      <td style={s.td}>{formatDate(sess.createdAt)}</td>
                      <td style={s.td}>
                        <span style={sess.isActive ? s.statusLive : s.statusEnded}>
                          {sess.isActive ? 'Active' : 'Ended'}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 600 }}>
                        {sess.studentCount}
                      </td>
                      <td style={{ ...s.td, display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => fetchSessionDetails(sess.id, sess.subject, sess.createdAt)}
                          style={s.viewBtn}
                          title="View details"
                        >
                          👁️ View
                        </button>
                        {sess.isActive && (
                          <button
                            onClick={() => endSessionById(sess.fullSessionId, sess.id)}
                            disabled={endingSession}
                            style={s.historyEndBtn}
                            title="End this session"
                          >
                            ⏹ End
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detailed Session Modal ──────────────── */}
      {selectedSessionForDetails && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent}>
            <div style={s.modalHeader}>
              <h2 style={{ margin: 0 }}>📋 {selectedSessionForDetails.subject}</h2>
              <button style={s.modalCloseBtn} onClick={() => setSelectedSessionForDetails(null)}>✖</button>
            </div>
            <p style={{ color: '#aaa', marginTop: '4px', marginBottom: '16px' }}>
              {formatDate(selectedSessionForDetails.date)} — {sessionDetails.length} Student(s) Attended
            </p>

            {detailsLoading ? (
              <p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Loading details...</p>
            ) : detailsError ? (
              <p style={{ textAlign: 'center', padding: '20px', color: '#ff6b6b' }}>{detailsError}</p>
            ) : sessionDetails.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No students marked attendance for this session.</p>
            ) : (
              <div style={s.tableWrapper}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Name</th>
                      <th style={s.th}>Email</th>
                      <th style={s.th}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionDetails.map((att) => (
                      <tr key={att._id} style={s.tr}>
                        <td style={s.td}>{att.studentId?.name || 'Unknown'}</td>
                        <td style={s.td}>{att.studentId?.email || 'N/A'}</td>
                        <td style={s.td}>{formatDate(att.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════
const styles = {
  container: {
    minHeight: '100vh',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  roleBadge: {
    display: 'inline-block',
    background: '#6c63ff',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    padding: '3px 10px',
    borderRadius: '20px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginTop: '4px',
  },
  userInfo: { color: '#a0a0c0' },
  logoutBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#ff6b6b',
    cursor: 'pointer',
  },
  content: { maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  card: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
  },
  cardTitle: { marginBottom: '12px', fontSize: '1.2rem' },

  // ── Messages ──
  successBox: {
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid rgba(16,185,129,0.3)',
    padding: '10px',
    borderRadius: '8px',
    color: '#10b981',
    fontSize: '0.9rem',
    textAlign: 'center',
    cursor: 'pointer',
  },
  errorBox: {
    background: 'rgba(255,50,50,0.15)',
    border: '1px solid rgba(255,50,50,0.3)',
    padding: '10px',
    borderRadius: '8px',
    color: '#ff6b6b',
    fontSize: '0.9rem',
    textAlign: 'center',
    cursor: 'pointer',
  },

  // ── Form ──
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none',
  },
  primaryBtn: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: '#6c63ff',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },

  // ── QR Display ──
  qrHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  qrWrapper: {
    background: '#fff',
    borderRadius: '12px',
    padding: '12px',
    display: 'inline-block',
    margin: '0 auto',
  },
  qrImage: {
    width: '220px',
    height: '220px',
    display: 'block',
  },
  liveBadge: {
    background: '#ff4444',
    color: '#fff',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '1px',
    animation: 'pulse 1.5s infinite',
  },
  endedBadge: {
    background: '#555',
    color: '#ccc',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  endBtn: {
    marginTop: '16px',
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: '#e74c3c',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },

  // ── Session History ──
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  refreshBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: {
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    color: '#888',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.05)' },
  td: { padding: '10px', color: '#ddd' },
  statusLive: { color: '#10b981', fontWeight: 600 },
  statusEnded: { color: '#888' },
  historyEndBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    background: '#e74c3c',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.2s',
  },
  viewBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(108, 99, 255, 0.5)',
    background: 'transparent',
    color: '#6c63ff',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: 'rgba(30,30,45,0.95)',
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    overflowY: 'auto',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#aaa',
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
};

