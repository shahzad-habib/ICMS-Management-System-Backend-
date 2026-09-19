const express = require('express');
const router = express.Router();
const { applyLeave, updateLeaveStatus, getAllLeaves, getMyLeaves } = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleCheck');

// Apply protect middleware to all leave routes
router.use(protect);

router.post('/apply', applyLeave);
router.get('/my-leaves', getMyLeaves);
router.get('/', isAdmin, getAllLeaves);
router.put('/:id/status', isAdmin, updateLeaveStatus);

module.exports = router;
