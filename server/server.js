// ─────────────────────────────────────────────
// Pro Attendance — MERN Backend Server
// ─────────────────────────────────────────────
require('dotenv').config();          // Load .env variables first
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');

// ── Route imports ─────────────────────────
const authRoutes = require('./routes/auth');
const qrRoutes = require('./routes/qr');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & parsing middleware ─────────
app.use(helmet());                    // HTTP headers security
app.use(cors());                      // Enable CORS for frontend
app.use(morgan('dev'));               // Request logging
app.use(express.json({ limit: '10kb' })); // Body parser with size limit
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Health check endpoint ────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Pro Attendance API is running',
    timestamp: new Date().toISOString(),
  });
});

// ── Mount routes ─────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/attendance', attendanceRoutes);

// ── 404 handler ──────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ─────────────────
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ── Start server ─────────────────────────
const startServer = async () => {
  await connectDB();
  app.listen(PORT,'0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();

