const SystemSettings = require('../models/SystemSettings');

const ipCheck = async (req, res, next) => {
  try {
    const settings = await SystemSettings.findOne();
    
    // If no settings exist, or IP restriction is disabled/optional, or allowedIPs is empty -> allow access
    if (!settings || !settings.isIpRestrictionEnabled || !settings.allowedIPs || settings.allowedIPs.length === 0) {
       return next();
    }

    // Extract client IP (checking x-forwarded-for first for proxy setups)
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;

    if (!settings.allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        message: "Access Denied. Please connect to the official ICMS Wi-Fi."
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error during IP validation', error: error.message });
  }
};

module.exports = { ipCheck };
