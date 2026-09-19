const Leave = require('../models/Leave');

// @desc    Apply for a leave
// @route   POST /api/leaves/apply
// @access  Private (Teacher)
const applyLeave = async (req, res) => {
  try {
    const { startDate, endDate, leaveType, reason } = req.body;

    if (!startDate || !endDate || !leaveType || !reason) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate that startDate is not after endDate
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ message: 'Start date cannot be after end date.' });
    }

    // Prevent applying for leaves in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(startDate) < today) {
      return res.status(400).json({ message: 'Leave start date cannot be in the past.' });
    }

    const leave = await Leave.create({
      teacherId: req.user._id,
      startDate,
      endDate,
      leaveType,
      reason,
      status: 'Pending',
    });

    res.status(201).json({ message: 'Leave application submitted successfully', leave });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update leave status
// @route   PUT /api/leaves/:id/status
// @access  Private (Admin)
const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required (Approved or Rejected)' });
    }

    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    leave.status = status;
    await leave.save();

    res.status(200).json({ message: `Leave ${status.toLowerCase()} successfully`, leave });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all leaves (for admin)
// @route   GET /api/leaves
// @access  Private (Admin)
const getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find().populate('teacherId', 'name employeeId').sort({ createdAt: -1 });
    res.status(200).json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current teacher's leaves
// @route   GET /api/leaves/my-leaves
// @access  Private (Teacher)
const getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ teacherId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  applyLeave,
  updateLeaveStatus,
  getAllLeaves,
  getMyLeaves,
};
