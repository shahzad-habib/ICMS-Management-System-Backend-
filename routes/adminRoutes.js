const express = require('express');
const router = express.Router();
const {
  markManualAttendance,
  getSettings,
  updateSettings,
  getDashboardStats,
  createTeacher,
  getAllTeachers,
  updateTeacher,
  toggleTeacherStatus,
} = require('../controllers/adminController');
const {
  getAllAttendance,
  exportAttendanceCSV,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleCheck');

// Apply both auth and admin middleware to all routes
router.use(protect, isAdmin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Attendance Logs & Payroll Export
router.get('/attendance', getAllAttendance);
router.get('/attendance/export', exportAttendanceCSV);
router.post('/attendance/manual', markManualAttendance);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Teacher Management
router.post('/teachers', createTeacher);
router.get('/teachers', getAllTeachers);
router.patch('/teachers/:id', updateTeacher);
router.patch('/teachers/:id/status', toggleTeacherStatus);

module.exports = router;
