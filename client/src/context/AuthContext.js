import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// ── Configure axios defaults ──────────────────────────
const API = axios.create({ baseURL: 'http://localhost:5000/api' });

// Attach JWT token to every request if available
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      API.get('/auth/me')
        .then((res) => setUser(res.data.user))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (data) => {
    const res = await API.post('/auth/register', data);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // ── Save teacher's classroom GPS location ──────────
  const saveLocation = async (lat, lng) => {
    const res = await API.put('/auth/location', { lat, lng });
    // Update user state with new location
    setUser((prev) => ({ ...prev, classroomLocation: res.data.classroomLocation }));
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, saveLocation, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
