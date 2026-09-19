const mongoose = require('mongoose');

/**
 * Leave Schema
 * Manages advance leave requests.
 * Reference: database_schema_api_design.md §1.3
 */
const leaveSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    leaveType: {
      type: String,
      enum: ['Sick', 'Casual', 'Emergency'],
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Leave reason is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

// Indexes for fast admin status filtering and teacher history
leaveSchema.index({ status: 1, createdAt: -1 });
leaveSchema.index({ teacherId: 1, status: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
