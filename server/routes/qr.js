const express = require('express');
const { body, validationResult } = require('express-validator');
const QRSession = require('../models/QRSession');
const Attendance = require('../models/Attendance');
const { protect, authorize } = require('../middleware/auth');
const { generateSessionId, generateQRDataUrl } = require('../utils/qrHelper');

const router = express.Router();

/**
 * ─────────────────────────────────────────────
 * POST /api/qr/generate
 * Teacher generates a new QR session for a subject.
 * Session expires after QR_TTL_SECONDS (default 45s).
 * ─────────────────────────────────────────────
 */
router.post(
  '/generate',
  protect,
  authorize('teacher'),
  [
    body('subject')
      .trim()
      .notEmpty()
      .withMessage('Subject name is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { subject } = req.body;
      const ttlSeconds = parseInt(process.env.QR_TTL_SECONDS) || 45;

      // Create a new QR session
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const session = await QRSession.create({
        sessionId,
        teacherId: req.user._id,
        subject,
        expiresAt,
      });

      // Generate QR code as a data URL
      const qrDataUrl = await generateQRDataUrl({
        sessionId,
        subject,
        expiresAt: expiresAt.toISOString(),
      });

      res.json({
        success: true,
        qr: qrDataUrl,
        session: {
          id: session._id,
          sessionId: session.sessionId,
          subject: session.subject,
          expiresAt: session.expiresAt,
          ttlSeconds,
        },
      });
    } catch (err) {
      console.error('QR generate error:', err);
      res.status(500).json({ success: false, message: 'Failed to generate QR code' });
    }
  }
);

/**
 * ─────────────────────────────────────────────
 * POST /api/qr/validate
 * Validate a QR session ID. Used by the student's
 * device before attempting to mark attendance.
 * ─────────────────────────────────────────────
 */
router.post(
  '/validate',
  protect,
  authorize('student'),
  [body('sessionId').notEmpty().withMessage('Session ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { sessionId } = req.body;

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

      res.json({
        success: true,
        valid: true,
        session: {
          id: session._id,
          subject: session.subject,
          expiresAt: session.expiresAt,
        },
      });
    } catch (err) {
      console.error('QR validate error:', err);
      res.status(500).json({ success: false, message: 'Failed to validate QR code' });
    }
  }
);

/**
 * ─────────────────────────────────────────────
 * PUT /api/qr/end
 * Teacher manually ends an active QR session.
 * ─────────────────────────────────────────────
 */
router.put(
  '/end',
  protect,
  authorize('teacher'),
  [body('sessionId').notEmpty().withMessage('Session ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { sessionId } = req.body;

      const session = await QRSession.findOne({
        sessionId,
        teacherId: req.user._id,
        isActive: true,
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Active session not found',
        });
      }

      session.isActive = false;
      session.expiresAt = new Date(); // Expire immediately
      await session.save();

      res.json({
        success: true,
        message: 'Session ended successfully',
      });
    } catch (err) {
      console.error('QR end error:', err);
      res.status(500).json({ success: false, message: 'Failed to end session' });
    }
  }
);

/**
 * ─────────────────────────────────────────────
 * GET /api/qr/sessions
 * Teacher gets all their sessions (active & past)
 * with attendance counts.
 * ─────────────────────────────────────────────
 */
router.get('/sessions', protect, authorize('teacher'), async (req, res) => {
  try {
    const sessions = await QRSession.find({ teacherId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Get attendance counts for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (s) => {
        const count = await Attendance.countDocuments({ qrSessionId: s._id });
        return {
          id: s._id,
          sessionId: s.sessionId.slice(0, 12) + '...',
          fullSessionId: s.sessionId,
          subject: s.subject,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          isActive: s.isActive && s.expiresAt > new Date(),
          studentCount: count,
        };
      })
    );

    res.json({
      success: true,
      count: sessionsWithCounts.length,
      sessions: sessionsWithCounts,
    });
  } catch (err) {
    console.error('QR sessions error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

module.exports = router;

