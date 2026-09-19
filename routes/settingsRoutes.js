const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleCheck');

// Apply auth and admin check to system settings
router.use(protect, isAdmin);

router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;
