const express = require('express');
const { body, validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const QRSession = require('../models/QRSession');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { checkGeoFence } = require('../config/geo');

const router = express.Router();

/**
 * POST /api/attendance/mark
 * Student marks attendance with:
 * 1. Valid QR session ID
 * 2. GPS inside classroom geo-fence (teacher's dynamic location or env default)
 * 3. No duplicate attendance for this session
 */
router.post(
  '/mark',
  protect,
  authorize('student'),
  [
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { sessionId, lat, lng } = req.body;

      // ── Step 1: Validate QR session ───────────────────────
      const session = await QRSession.findOne({
        sessionId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        return res.status(400).json({
          success: false,
          message: 'QR session is invalid or has expired',
        });
      }

      // ── Step 2: Get teacher's dynamic classroom location ──
      // If the teacher saved their GPS location via browser, use it.
      // Otherwise fall back to the static GEO_* env variables.
      const teacher = await User.findById(session.teacherId).select('classroomLocation');
      const teacherLocation = teacher?.classroomLocation;

      // ── Step 3: Check geo-fence ───────────────────────────
      const geoCheck = checkGeoFence(lat, lng, teacherLocation);
      if (!geoCheck.allowed) {
        return res.status(400).json({
          success: false,
          message: `You are outside the classroom. You are ${geoCheck.distance}m away (max ${geoCheck.maxDistance}m).`,
          geo: geoCheck,
        });
      }

      // ── Step 4: Check for duplicate attendance ────────────
      const existing = await Attendance.findOne({
        studentId: req.user._id,
        qrSessionId: session._id,
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Attendance already marked for this session',
          attendance: existing,
        });
      }

      // ── Step 5: Mark attendance ───────────────────────────
      const attendance = await Attendance.create({
        studentId: req.user._id,
        qrSessionId: session._id,
        subject: session.subject,
        location: { lat, lng },
        distanceFromClassroom: geoCheck.distance,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      });

      // NOTE: Session stays active so ALL students can scan the same QR.
      // It auto-expires based on its TTL (default 45s).
      // Teacher can manually end it with the End Session button.

      res.status(201).json({
        success: true,
        message: `✅ Attendance marked for ${session.subject}`,
        geo: geoCheck,
        attendance: {
          id: attendance._id,
          subject: attendance.subject,
          status: attendance.status,
          location: attendance.location,
          distanceFromClassroom: attendance.distanceFromClassroom,
          timestamp: attendance.createdAt,
        },
      });
    } catch (err) {
      console.error('Attendance mark error:', err);
      res.status(500).json({ success: false, message: 'Failed to mark attendance' });
    }
  }
);

/**
 * GET /api/attendance/history
 * Get attendance history for the logged-in student.
 */
router.get('/history', protect, authorize('student'), async (req, res) => {
  try {
    const attendance = await Attendance.find({ studentId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, count: attendance.length, attendance });
  } catch (err) {
    console.error('Attendance history error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance history' });
  }
});

/**
 * GET /api/attendance/session/:sessionId
 * Teacher views all students who marked attendance for a session.
 */
router.get('/session/:sessionId', protect, authorize('teacher'), async (req, res) => {
  try {
    const session = await QRSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view attendance for your own sessions',
      });
    }
    const attendance = await Attendance.find({ qrSessionId: session._id })
      .populate('studentId', 'name email studentId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      session: { subject: session.subject, createdAt: session.createdAt, expiresAt: session.expiresAt },
      totalStudents: attendance.length,
      attendance,
    });
  } catch (err) {
    console.error('Session attendance error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch session attendance' });
  }
});

module.exports = router;
