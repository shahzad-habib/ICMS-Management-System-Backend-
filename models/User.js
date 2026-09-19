const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema — Teachers & Admins
 *
 * Design decisions (Senior SE):
 *  - `password` is excluded from queries by default (select: false) to
 *    prevent accidental leaks through serialization.
 *  - `passwordChangedAt` is updated on every password change so we can
 *    invalidate JWTs issued before the change (future-proofing).
 *  - `mustChangePassword` forces a credential rotation after an admin reset,
 *    following the least-privilege principle.
 *  - `employeeId` is indexed + immutable at the application layer; it is
 *    used as a FK across Attendance and Leave collections.
 *  - Compound index on (role, isActive) supports the admin dashboard's
 *    active-teacher queries without a collection scan.
 *
 * Reference: database_schema_api_design.md §1.1
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Employee ID cannot exceed 20 characters'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // NEVER expose in API responses
    },
    role: {
      type: String,
      enum: ['Teacher', 'Admin'],
      default: 'Teacher',
    },
    department: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Department cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [20, 'Phone cannot exceed 20 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ── Security / Audit fields ────────────────────────────
    /**
     * Timestamp of last password change.
     * Used to invalidate JWTs issued before this date if needed.
     */
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    /**
     * Timestamp of last successful login.
     */
    lastLoginAt: {
      type: Date,
      default: null,
    },
    /**
     * When true, the teacher is redirected to change their password
     * on next login (set by admin after a password reset).
     */
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Compound index for admin dashboard active-teacher queries ──
userSchema.index({ role: 1, isActive: 1 });

// ── Pre-save hook: hash password on create or change ──────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // Salt rounds = 12 (OWASP recommended minimum for bcrypt)
  this.password = await bcrypt.hash(this.password, 12);

  // Record when password was last changed (skip on initial creation)
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }

  next();
});

// ── Instance method: verify a candidate password ──────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Instance method: check if a JWT was issued before the last
 * password change (for future JWT invalidation support).
 * @param {number} JWTTimestamp - iat field from decoded JWT
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTime = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTime;
  }
  return false;
};

module.exports = mongoose.model('User', userSchema);
