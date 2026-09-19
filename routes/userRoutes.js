const express = require('express');
const router = express.Router();
const { changePassword, getMe } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication (Teacher or Admin)
router.use(protect);

// GET own profile
router.get('/me', getMe);

// Self-service password change
router.patch('/change-password', changePassword);

module.exports = router;
