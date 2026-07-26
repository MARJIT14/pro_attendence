const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: Generate JWT token for a user
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/register
 * Register a new user (student or teacher)
 * Teachers can optionally provide GPS lat/lng to set classroom location at sign-up.
 */
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['student', 'teacher']).withMessage('Role must be student or teacher'),
    body('lat').optional({ values: 'falsy' }).isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('lng').optional({ values: 'falsy' }).isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      const { name, email, password, role, studentId, lat, lng } = req.body;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User with this email already exists' });
      }

      const userData = {
        name, email, password,
        role: role || 'student',
        studentId: role === 'student' ? studentId : undefined,
      };

      // If teacher provided GPS during sign-up, save it as classroom location
      if (role === 'teacher' && lat && lng) {
        userData.classroomLocation = { lat, lng };
      }

      const user = await User.create(userData);
      const token = generateToken(user);
      res.status(201).json({
        success: true, token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, studentId: user.studentId, classroomLocation: user.classroomLocation },
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ success: false, message: 'Server error during registration' });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }
      const token = generateToken(user);
      res.json({
        success: true, token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, studentId: user.studentId, classroomLocation: user.classroomLocation },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Server error during login' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current logged-in user's profile
 */
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * PUT /api/auth/location
 * Teacher saves their classroom GPS location (browser GPS).
 * This overrides the static GEO_* env variables for this teacher.
 */
router.put(
  '/location',
  protect,
  authorize('teacher'),
  [
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      const { lat, lng } = req.body;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { classroomLocation: { lat, lng } },
        { new: true, runValidators: true }
      ).select('-password');
      console.log(`📍 Teacher "${user.name}" set classroom location: ${lat}, ${lng}`);
      res.json({
        success: true,
        message: '📍 Classroom location saved! Students must be within this area.',
        classroomLocation: user.classroomLocation,
      });
    } catch (err) {
      console.error('Save location error:', err);
      res.status(500).json({ success: false, message: 'Failed to save location' });
    }
  }
);

module.exports = router;
