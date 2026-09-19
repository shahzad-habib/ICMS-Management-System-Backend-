const Attendance = require('../models/Attendance');
const SystemSettings = require('../models/SystemSettings');

// Helper function to get current date in YYYY-MM-DD (local server time)
const getFormattedDate = (dateObj) => {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// @desc    Mark Check-In
// @route   POST /api/attendance/check-in
// @access  Private (Teacher)
const checkIn = async (req, res) => {
  try {
    // Strictly use Node.js server time
    const now = new Date();
    const dateString = getFormattedDate(now);

    // Query the database to ensure the user hasn't already checked in for today
    const existingRecord = await Attendance.findOne({
      teacherId: req.user._id,
      date: dateString
    });

    if (existingRecord) {
      return res.status(400).json({ message: 'You have already checked in for today.' });
    }

    // Extract client IP (checking x-forwarded-for first for proxies)
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;

    // Create a new attendance record
    const attendance = await Attendance.create({
      teacherId: req.user._id,
      date: dateString,
      checkInTime: now,
      ipAddress: clientIP,
      status: 'Present', // Default status upon check-in
    });

    res.status(201).json({ message: 'Check-in successful', attendance });
  } catch (error) {
    // Handle potential duplicate key error from MongoDB index
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already checked in for today.' });
    }
    res.status(500).json({ message: 'Server error during check-in', error: error.message });
  }
};

// @desc    Mark Check-Out
// @route   POST /api/attendance/check-out
// @access  Private (Teacher)
const checkOut = async (req, res) => {
  try {
    // Strictly use Node.js server time
    const now = new Date();
    const dateString = getFormattedDate(now);
    const { checkOutReason } = req.body;
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;

    // Find the existing attendance record for today
    const attendance = await Attendance.findOne({
      teacherId: req.user._id,
      date: dateString
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No check-in record found for today.' });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({ message: 'You have already checked out for today.' });
    }

    // Fetch requiredWorkingHours from the Settings model
    const settings = await SystemSettings.findOne();
    const requiredHours = settings ? settings.requiredDailyHours : 6; // fallback to 6
    const fridayHours = settings?.fridayRequiredHours || 3; // dynamic Friday threshold

    // Calculate time difference in hours
    const checkInTime = new Date(attendance.checkInTime);
    const timeDiffMs = now - checkInTime;
    const workingHours = parseFloat((timeDiffMs / (1000 * 60 * 60)).toFixed(2));

    // Check if today is Friday (5 = Friday)
    const isFriday = now.getDay() === 5;
    // Dynamic thresholds
    const halfDayThreshold = isFriday ? fridayHours : 3.5;
    const requiredHoursForDay = isFriday ? fridayHours : requiredHours;

    // A sign-out reason is now mandatory for every check-out
    if (!checkOutReason) {
      return res.status(400).json({ message: 'Check-out reason is mandatory.' });
    }

    // Calculate the final status:
    // - Less than half-day threshold is considered Half Day
    // - Extremely short time (< halfDayThreshold / 2) is considered Absent
    // - Equal or more is considered Present
    let finalStatus = 'Present';
    if (workingHours > 0 && workingHours < (halfDayThreshold / 2)) {
      finalStatus = 'Absent';
    } else if (workingHours < halfDayThreshold) {
      finalStatus = 'Half Day';
    }

    // Update the record
    attendance.checkOutTime = now;
    attendance.workingHours = workingHours;
    if (checkOutReason) attendance.checkOutReason = checkOutReason;
    if (!attendance.ipAddress) attendance.ipAddress = clientIP;
    attendance.status = finalStatus;

    await attendance.save();

    res.status(200).json({ message: 'Check-out successful', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Server error during check-out', error: error.message });
  }
};

// @desc    Get current user's attendance records (with optional month/year filter)
// @route   GET /api/attendance/my-records
// @access  Private (Teacher)
const getMyRecords = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = { teacherId: req.user._id };

    if (year && month) {
      const paddedMonth = String(month).padStart(2, '0');
      query.date = { $regex: new RegExp(`^${year}-${paddedMonth}`) };
    } else if (year) {
      query.date = { $regex: new RegExp(`^${year}-`) };
    }

    const records = await Attendance.find(query).sort({ date: -1 });
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching attendance records', error: error.message });
  }
};

// @desc    Get all attendance records (Admin only, with filters)
// @route   GET /api/admin/attendance
// @access  Private (Admin)
const getAllAttendance = async (req, res) => {
  try {
    const { date, month, year, status, teacherId, search, page = 1, limit = 100 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10))); // cap at 500
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    if (date) {
      query.date = date;
    } else if (year && month) {
      const paddedMonth = String(month).padStart(2, '0');
      query.date = { $regex: new RegExp(`^${year}-${paddedMonth}`) };
    } else if (year) {
      query.date = { $regex: new RegExp(`^${year}-`) };
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (teacherId) {
      query.teacherId = teacherId;
    }

    let records = await Attendance.find(query)
      .populate('teacherId', 'name employeeId department phone')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Filter by search query if present (post-populate filter)
    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      records = records.filter((r) => {
        const name = r.teacherId?.name?.toLowerCase() || '';
        const empId = r.teacherId?.employeeId?.toLowerCase() || '';
        const dept = r.teacherId?.department?.toLowerCase() || '';
        return name.includes(term) || empId.includes(term) || dept.includes(term);
      });
    }

    const total = await Attendance.countDocuments(query);

    res.status(200).json({
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching all attendance', error: error.message });
  }
};

// @desc    Export attendance as CSV (Admin only)
// @route   GET /api/admin/attendance/export
// @access  Private (Admin)
const exportAttendanceCSV = async (req, res) => {
  try {
    const { month, year, date, status } = req.query;
    let query = {};

    if (date) {
      query.date = date;
    } else if (year && month) {
      const paddedMonth = String(month).padStart(2, '0');
      query.date = { $regex: new RegExp(`^${year}-${paddedMonth}`) };
    } else if (year) {
      query.date = { $regex: new RegExp(`^${year}-`) };
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    const records = await Attendance.find(query)
      .populate('teacherId', 'name employeeId department')
      .sort({ date: 1, 'teacherId.employeeId': 1 });

    const csvHeaders = [
      'Date',
      'Employee ID',
      'Name',
      'Department',
      'Check-In Time',
      'Check-Out Time',
      'Working Hours',
      'Status',
      'Entry Type',
      'IP Address',
      'Reason / Remarks'
    ];

    const escapeCsv = (val) => {
      if (val == null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = records.map((r) => [
      escapeCsv(r.date),
      escapeCsv(r.teacherId?.employeeId || '—'),
      escapeCsv(r.teacherId?.name || 'Unknown'),
      escapeCsv(r.teacherId?.department || 'Faculty'),
      escapeCsv(r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-US') : '—'),
      escapeCsv(r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-US') : '—'),
      escapeCsv(r.workingHours != null ? r.workingHours : '0'),
      escapeCsv(r.status),
      escapeCsv(r.isManualEntry ? 'Manual Override' : 'School Wi-Fi'),
      escapeCsv(r.ipAddress || '—'),
      escapeCsv(r.checkOutReason || '')
    ].join(','));

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\r\n');
    const filename = `attendance-report-${date || `${year || 'all'}-${month || 'records'}`}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: 'Server error exporting CSV', error: error.message });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getMyRecords,
  getAllAttendance,
  exportAttendanceCSV,
};
