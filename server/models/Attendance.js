const mongoose = require('mongoose');

/**
 * Attendance Schema
 * Records each attendance marking with GPS coordinates and QR session linkage.
 * A student cannot have duplicate attendance for the same QR session.
 */
const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    qrSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QRSession',
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    // GPS coordinates where attendance was marked
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    // Distance from classroom center (meters)
    distanceFromClassroom: {
      type: Number,
      required: true,
    },
    // Status of this attendance record
    status: {
      type: String,
      enum: ['present', 'late', 'absent'],
      default: 'present',
    },
    // IP address of the student at time of marking
    ipAddress: {
      type: String,
    },
  },
  { timestamps: true }
);

// Prevent duplicate attendance for same student + session
attendanceSchema.index({ studentId: 1, qrSessionId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

