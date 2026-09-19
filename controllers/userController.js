const User = require('../models/User');
const crypto = require('crypto');

/**
 * @desc    Teacher/Admin changes their own password (self-service)
 * @route   PATCH /api/user/change-password
 * @access  Private (Teacher | Admin)
 *
 * Body: { currentPassword, newPassword, confirmPassword }
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // ── Input validation ──────────────────────────────────
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All three fields are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from the current password.' });
    }

    // Re-fetch user WITH password field (excluded by default via select:false)
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // ── Verify current password ───────────────────────────
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    // ── Save new password (pre-save hook hashes it + sets passwordChangedAt) ──
    user.password = newPassword;
    user.mustChangePassword = false; // Clear the forced-change flag if set
    await user.save();

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


/**
 * @desc    Get logged-in user's own profile
 * @route   GET /api/user/me
 * @access  Private (Teacher | Admin)
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-__v');
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { changePassword, getMe };
