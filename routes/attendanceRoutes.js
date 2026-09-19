const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getMyRecords } = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { ipCheck } = require('../middleware/ipCheck');

// Apply auth to all attendance routes
router.use(protect);

// Actions requiring school Wi-Fi
router.post('/check-in', ipCheck, checkIn);
router.post('/check-out', ipCheck, checkOut);

// Read-only attendance logs
router.get('/my-records', getMyRecords);

module.exports = router;
