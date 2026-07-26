import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

const QR_READER_ID = 'attendance-qr-reader';

export default function StudentDashboard() {
  // Scoped keyframes injection
  const animStyle = `@keyframes scanning { 0% { top: 20%; } 50% { top: 70%; } 100% { top: 20%; } }`;
  const { user, logout, API } = useAuth();
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [step, setStep] = useState('scan');
  const [scannedData, setScannedData] = useState(null);
  const [location, setLocation] = useState(null);
  const [geoStatus, setGeoStatus] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  // ── Get GPS location ───────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('✅ Location acquired');
      },
      () => {
        setGeoStatus('❌ GPS denied — enable location services');
        setError('GPS is required to mark attendance');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Start QR scanner ───────────────────────────
  const startScanner = useCallback(async () => {
    setError('');

    try {
      // Clean previous instance
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch {}
        try { await scannerRef.current.clear(); } catch {}
        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode(QR_READER_ID);
      scannerRef.current = scanner;

      // Define scan region dimensions
      const qrboxSize = Math.min(window.innerWidth * 0.6, 280);

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 30,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1.0,
        },
        // onSuccess — QR decoded!
        (decodedText) => {
          // Vibrate on success if supported
          try { navigator.vibrate?.(200); } catch {}

          // Stop immediately
          try { scanner.stop().catch(() => {}); } catch {}
          scannerRef.current = null;
          setCameraActive(false);

          // Parse QR payload
          try {
            const data = JSON.parse(decodedText);
            setScannedData({
              sessionId: data.sid,
              subject: data.sub,
              expiresAt: data.exp,
            });
          } catch {
            // Plain text session ID
            setScannedData({ sessionId: decodedText.trim() });
          }
          setStep('confirming');
        },
        // onFailure — silently continue
        () => {}
      );

      setCameraActive(true);
    } catch (err) {
      setError('Camera unavailable. Use the manual session ID field below.');
      console.warn('Scanner error:', err);
    }
  }, []);

  // ── Stop scanner ───────────────────────────────
  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      try { scannerRef.current.stop().catch(() => {}); } catch {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop().catch(() => {}); } catch {}
      }
    };
  }, []);

  // ── Manual entry ───────────────────────────────
  const [manualSessionId, setManualSessionId] = useState('');

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualSessionId.trim()) return;
    stopScanner();
    setScannedData({ sessionId: manualSessionId.trim() });
    setStep('confirming');
  };

  // ── Mark attendance ────────────────────────────
  const markAttendance = async () => {
    if (!location) {
      setError('GPS location not available');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/attendance/mark', {
        sessionId: scannedData.sessionId,
        lat: location.lat,
        lng: location.lng,
      });
      setMessage(res.data.message);
      setStep('done');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to mark attendance';
      if (msg.includes('not authorized') || msg.includes('Role')) {
        setError(
          'Your account role is not "student". Register/login as a student using a different email to mark attendance.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ──────────────────────────────────────
  const resetScan = () => {
    stopScanner();
    setStep('scan');
    setScannedData(null);
    setMessage('');
    setError('');
    setManualSessionId('');
  };

  const handleLogout = () => {
    stopScanner();
    logout();
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <style>{animStyle}</style>
      <div style={styles.header}>
        <div>
          <h1>🎓 Student Dashboard</h1>
          <span style={styles.roleBadge}>{user?.role}</span>
        </div>
        <div>
          <span style={styles.userInfo}>{user?.name}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </div>

      <div style={styles.content}>
        {/* ── GPS Status ── */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📍 Location</h2>
          <p style={{ color: location ? '#10b981' : '#ff6b6b' }}>
            {geoStatus || 'Acquiring GPS...'}
          </p>
          {location && (
            <p style={{ fontSize: '0.8rem', color: '#888' }}>
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          )}
        </div>

        {/* ── Step 1: Scan ── */}
        {step === 'scan' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📷 Scan QR Code</h2>
            <p style={{ color: '#aaa', marginBottom: '12px' }}>
              Point your camera at the teacher's QR code
            </p>

            {/* ── Camera viewfinder ── */}
            <div style={styles.scannerWrapper}>
              <div id={QR_READER_ID} style={cameraActive ? styles.qrReader : { width: '100%', height: '220px' }}></div>

              {/* Scanning animation overlay — only when camera is active */}
              {cameraActive && (
                <div style={styles.scanOverlay}>
                  <div style={styles.scanCornerTL}></div>
                  <div style={styles.scanCornerTR}></div>
                  <div style={styles.scanCornerBL}></div>
                  <div style={styles.scanCornerBR}></div>
                  <div style={styles.scanLine}></div>
                  <p style={styles.scanHint}>Align QR code within the frame</p>
                </div>
              )}

              {!cameraActive && (
                <div style={styles.cameraPlaceholder}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📸</div>
                  <p style={{ color: '#888' }}>Camera preview will appear here</p>
                </div>
              )}
            </div>

            {!cameraActive && (
              <button onClick={startScanner} style={styles.button}>
                📸 Start Camera Scanner
              </button>
            )}

            {cameraActive && (
              <button
                onClick={stopScanner}
                style={{ ...styles.button, background: '#e74c3c', marginTop: '8px' }}
              >
                🛑 Stop Camera
              </button>
            )}

            <div style={styles.divider}>
              <span style={styles.dividerText}>OR enter session ID manually</span>
            </div>

            <form onSubmit={handleManualSubmit} style={styles.form}>
              <input
                value={manualSessionId}
                onChange={(e) => setManualSessionId(e.target.value)}
                placeholder="Paste the session ID from QR"
                style={styles.input}
              />
              <button type="submit" style={{ ...styles.button, background: '#555' }}>
                Use Session ID
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: Confirm ── */}
        {step === 'confirming' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>✅ Confirm Attendance</h2>
            {scannedData?.subject && (
              <p style={{ margin: '8px 0', fontSize: '1.1rem' }}>
                📚 <strong>{scannedData.subject}</strong>
              </p>
            )}
            <p style={{ fontSize: '0.85rem', color: '#aaa', wordBreak: 'break-all' }}>
              Session: {scannedData?.sessionId.slice(0, 24)}...
            </p>
            {location && (
              <p style={{ fontSize: '0.85rem', color: '#10b981', margin: '8px 0' }}>
                ✅ GPS locked — will verify against classroom geo-fence
              </p>
            )}
            {error && <div style={styles.error}>{error}</div>}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={resetScan} style={{ ...styles.button, background: '#555', flex: 1 }}>
                Cancel
              </button>
              <button onClick={markAttendance} disabled={loading} style={{ ...styles.button, flex: 1 }}>
                {loading ? '⏳ Verifying...' : '✅ Mark Present'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 'done' && (
          <div style={{ ...styles.card, textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ ...styles.cardTitle, color: '#6c63ff', textAlign: 'center' }}>
              Attendance Marked!
            </h2>
            <p style={{ fontSize: '1.1rem', margin: '12px 0' }}>{message}</p>
            <button onClick={resetScan} style={styles.button}>
              Scan Another QR
            </button>
          </div>
        )}
      </div>

      {error && step === 'scan' && <div style={{ ...styles.error, maxWidth: '500px', margin: '20px auto' }}>{error}</div>}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', padding: '20px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '10px',
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
  userInfo: { marginRight: '12px', color: '#a0a0c0' },
  logoutBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#ff6b6b',
    cursor: 'pointer',
  },
  content: { maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  card: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
  },
  cardTitle: { marginBottom: '12px', fontSize: '1.2rem' },

  // ── Scanner styles ─────────────────────────────
  scannerWrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '340px',
    margin: '0 auto 12px',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#0a0a1a',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  qrReader: {
    width: '100%',
    minHeight: '260px',
  },
  cameraPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '220px',
    color: '#555',
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  scanCornerTL: {
    position: 'absolute',
    top: '15px',
    left: '15px',
    width: '25px',
    height: '25px',
    borderTop: '3px solid #6c63ff',
    borderLeft: '3px solid #6c63ff',
    borderRadius: '4px 0 0 0',
  },
  scanCornerTR: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    width: '25px',
    height: '25px',
    borderTop: '3px solid #6c63ff',
    borderRight: '3px solid #6c63ff',
    borderRadius: '0 4px 0 0',
  },
  scanCornerBL: {
    position: 'absolute',
    bottom: '15px',
    left: '15px',
    width: '25px',
    height: '25px',
    borderBottom: '3px solid #6c63ff',
    borderLeft: '3px solid #6c63ff',
    borderRadius: '0 0 0 4px',
  },
  scanCornerBR: {
    position: 'absolute',
    bottom: '15px',
    right: '15px',
    width: '25px',
    height: '25px',
    borderBottom: '3px solid #6c63ff',
    borderRight: '3px solid #6c63ff',
    borderRadius: '0 0 4px 0',
  },
  scanLine: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #6c63ff, transparent)',
    boxShadow: '0 0 8px #6c63ff, 0 0 20px #6c63ff44',
    animation: 'scanning 2s ease-in-out infinite',
  },
  scanHint: {
    position: 'absolute',
    bottom: '10px',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.7rem',
  },

  // ── Form elements ──
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    background: '#6c63ff',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  divider: {
    textAlign: 'center',
    margin: '16px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    lineHeight: '0.1em',
  },
  dividerText: {
    background: '#24243e',
    padding: '0 10px',
    fontSize: '0.8rem',
    color: '#888',
  },
  error: {
    background: 'rgba(255,50,50,0.15)',
    padding: '10px',
    borderRadius: '8px',
    color: '#ff6b6b',
    fontSize: '0.9rem',
    textAlign: 'center',
    marginTop: '12px',
  },
};

