const SystemSettings = require('../models/SystemSettings');

/**
 * ipRestriction — Checks the client's IP against the allowedIPs
 * stored in SystemSettings. Rejects with 403 if not matched.
 * Reference: SRS §3.2.1
 *
 * Works behind a proxy (e.g., Nginx/Heroku) via req.ip or
 * x-forwarded-for header.
 */
const ipRestriction = async (req, res, next) => {
  try {
    const settings = await SystemSettings.findOne();

    // If no settings exist, or IP restriction is disabled/optional, or allowedIPs is empty -> allow access
    if (!settings || !settings.isIpRestrictionEnabled || !settings.allowedIPs || settings.allowedIPs.length === 0) {
      return next();
    }

    // Extract real IP (supports reverse proxy)
    const clientIP =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress;

    if (!settings.allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        message: `Access denied. Your IP (${clientIP}) is not allowed to mark attendance.`,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { ipRestriction };
