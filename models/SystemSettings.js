const mongoose = require('mongoose');

/**
 * SystemSettings Schema
 * Stores dynamic variables managed by Admin.
 * Typically a single document in the collection.
 * Reference: database_schema_api_design.md §1.4
 */
const systemSettingsSchema = new mongoose.Schema(
  {
    isIpRestrictionEnabled: {
      type: Boolean,
      default: false, // Optional by default; teachers can sign in anytime
    },
    allowedIPs: {
      type: [String], // Array of allowed school IP addresses (SRS §3.2.1)
      default: [],
    },
    requiredDailyHours: {
      type: Number, // e.g., 6 hours (SRS §3.3.1)
      default: 6,
    },
    fridayRequiredHours: {
      type: Number, // e.g., 3 hours for Friday
      default: 3,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
