import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', studentId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('');

  // Auto-fetch GPS when teacher role is selected during registration
  useEffect(() => {
    if (!isRegister || form.role !== 'teacher') {
      setGpsLocation(null);
      setGpsStatus('');
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported');
      return;
    }

    setGpsStatus('Acquiring GPS for classroom location...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsStatus('GPS acquired - will be saved as classroom location');
      },
      (err) => {
        setGpsStatus('GPS denied - you can set it later from the dashboard');
        console.warn('GPS error during reg:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [isRegister, form.role]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // If registering as teacher with GPS, include it in the payload
      const payload =
        isRegister && form.role === 'teacher' && gpsLocation
          ? { ...form, lat: gpsLocation.lat, lng: gpsLocation.lng }
          : form;

      const user = isRegister ? await register(payload) : await login(form.email, form.password);
      navigate(user.role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Pro Attendance</h1>
        <h2 style={styles.subtitle}>{isRegister ? 'Create Account' : 'Sign In'}</h2>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          {isRegister && (
            <>
              <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} style={styles.input} required />
              <input name="studentId" placeholder="Student ID (optional)" value={form.studentId} onChange={handleChange} style={styles.input} />
              <select name="role" value={form.role} onChange={handleChange} style={styles.input}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>

              {form.role === 'teacher' && gpsStatus && (
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: gpsLocation ? '#10b981' : '#ff6b6b',
                  textAlign: 'center',
                }}>
                  {gpsStatus}
                  {gpsLocation && (
                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginTop: 2 }}>
                      {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} style={styles.input} required />
          <input name="password" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={handleChange} style={styles.input} required minLength={6} />

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Processing...' : isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        <p style={styles.toggle} onClick={() => { setIsRegister(!isRegister); setError(''); }}>
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },
  card: {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  title: {
    textAlign: 'center',
    fontSize: '1.8rem',
    marginBottom: '8px',
  },
  subtitle: {
    textAlign: 'center',
    color: '#a0a0c0',
    marginBottom: '24px',
    fontWeight: 400,
  },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border 0.2s',
  },
  button: {
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
  error: {
    background: 'rgba(255,50,50,0.15)',
    border: '1px solid rgba(255,50,50,0.3)',
    padding: '10px',
    borderRadius: '8px',
    color: '#ff6b6b',
    fontSize: '0.9rem',
    textAlign: 'center',
  },
  toggle: {
    textAlign: 'center',
    color: '#6c63ff',
    cursor: 'pointer',
    marginTop: '16px',
    fontSize: '0.9rem',
  },
};
