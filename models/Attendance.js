const mongoose = require('mongoose');

/**
 * Attendance Schema
 * Tracks daily check-ins and check-outs.
 * Reference: database_schema_api_design.md §1.2
 */
const attendanceSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD for easy querying (SRS §1.2)
      required: true,
    },
    checkInTime: {
      type: Date,
      required: true,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    workingHours: {
      type: Number,
      default: null, // Calculated on check-out
    },
    checkOutReason: {
      type: String,
      default: null, // Mandatory if workingHours < requiredDailyHours (SRS §3.3)
    },
    status: {
      type: String,
      enum: ['Present', 'Half Day', 'Absent', 'Leave'],
      default: 'Present',
    },
    isManualEntry: {
      type: Boolean,
      default: false, // SRS §3.4.2 — flag manual entries
    },
    ipAddress: {
      type: String,
      default: null, // Client IP captured upon check-in/out (UI/UX §4.2)
    },
  },
  { timestamps: true }
);

// Compound index: one check-in per teacher per day (unique constraint)
attendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });
// Fast date and status filtering for admin dashboard & daily overview
attendanceSchema.index({ date: 1, status: 1 });
// Fast historical querying for individual teacher records
attendanceSchema.index({ teacherId: 1, date: -1 });
// Fast aggregation for payroll & month-range exports
attendanceSchema.index({ date: 1, teacherId: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
