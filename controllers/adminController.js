const Attendance = require('../models/Attendance');
const SystemSettings = require('../models/SystemSettings');
const Leave = require('../models/Leave');
const User = require('../models/User');

// @desc    Mark manual attendance for a teacher
// @route   POST /api/admin/attendance/manual
// @access  Private (Admin)
const markManualAttendance = async (req, res) => {
  try {
    const { teacherId, date, checkInTime, checkOutTime, reason } = req.body;

    if (!teacherId || !date) {
      return res.status(400).json({ message: 'Teacher Employee ID (teacherId) and date are required' });
    }

    const user = await User.findOne({ employeeId: teacherId });
    if (!user) {
        return res.status(404).json({ message: 'Teacher with this Employee ID not found' });
    }
    const actualTeacherId = user._id;

    // Check if attendance already exists for this date and teacher
    const existingAttendance = await Attendance.findOne({ teacherId: actualTeacherId, date });
    if (existingAttendance) {
      return res.status(400).json({ message: 'Attendance record already exists for this date' });
    }

    // Parse check-in and check-out
    const inTime = checkInTime ? new Date(`${date}T${checkInTime}`) : new Date(`${date}T08:00:00`);
    const outTime = checkOutTime ? new Date(`${date}T${checkOutTime}`) : new Date(`${date}T14:00:00`);

    let workingHours = null;
    let status = 'Present';

    if (outTime && outTime > inTime) {
      workingHours = parseFloat(((outTime - inTime) / (1000 * 60 * 60)).toFixed(2));
      const dateObj = new Date(date);
      const isFriday = dateObj.getDay() === 5;
      const settings = await SystemSettings.findOne();
      const fridayHours = settings?.fridayRequiredHours || 3;
      const halfDayThreshold = isFriday ? fridayHours : 3.5;

      if (workingHours < halfDayThreshold / 2) {
        status = 'Absent';
      } else if (workingHours < halfDayThreshold) {
        status = 'Half Day';
      } else {
        status = 'Present';
      }
    }

    const attendance = await Attendance.create({
      teacherId: actualTeacherId,
      date,
      checkInTime: inTime,
      checkOutTime: outTime,
      workingHours,
      checkOutReason: reason || "Manual Entry (Device Issue)",
      status,
      isManualEntry: true,
      ipAddress: "Admin Override"
    });

    res.status(201).json({ message: 'Manual attendance marked successfully', attendance });
  } catch (error) {
    if (error.code === 11000) {
       return res.status(400).json({ message: 'Attendance record already exists for this date (Duplicate)' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get system settings
// @route   GET /api/admin/settings or GET /api/settings
// @access  Private (Admin)
const getSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        requiredDailyHours: 6,
        fridayRequiredHours: 3,
        allowedIPs: ['::1', '127.0.0.1', '::ffff:127.0.0.1'],
      });
    }

    const currentClientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;

    res.status(200).json({
      settings,
      currentClientIP,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching settings', error: error.message });
  }
};

// @desc    Update system settings (working hours and IP)
// @route   PUT /api/admin/settings
// @access  Private (Admin)
const updateSettings = async (req, res) => {
  try {
    const { requiredWorkingHours, fridayRequiredHours, allowedIPAddress, allowedIPs, isIpRestrictionEnabled } = req.body;
    
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }

    if (isIpRestrictionEnabled !== undefined) {
      settings.isIpRestrictionEnabled = Boolean(isIpRestrictionEnabled);
    }

    if (requiredWorkingHours !== undefined) {
      settings.requiredDailyHours = Number(requiredWorkingHours);
    }

    if (fridayRequiredHours !== undefined) {
      settings.fridayRequiredHours = Number(fridayRequiredHours);
    }

    if (allowedIPs && Array.isArray(allowedIPs)) {
      settings.allowedIPs = allowedIPs.map(ip => ip.trim()).filter(Boolean);
    } else if (allowedIPAddress !== undefined) {
      settings.allowedIPs = Array.isArray(allowedIPAddress) 
        ? allowedIPAddress 
        : allowedIPAddress.split(',').map(s => s.trim()).filter(Boolean);
    }

    await settings.save();

    res.status(200).json({ message: 'Settings updated successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating settings', error: error.message });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard/stats
// @access  Private (Admin)
const getDashboardStats = async (req, res) => {
  try {
    // Current date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    const totalStaff = await User.countDocuments({ role: 'Teacher', isActive: true });
    
    const todaysAttendances = await Attendance.find({ date: today });
    const presentToday = todaysAttendances.filter(a => ['Present', 'Half Day'].includes(a.status)).length;
    const absentToday = todaysAttendances.filter(a => a.status === 'Absent').length;

    // Find leaves approved for today
    const todayDateObj = new Date();
    todayDateObj.setHours(0,0,0,0);
    const endOfTodayObj = new Date(todayDateObj);
    endOfTodayObj.setHours(23,59,59,999);

    const leavesApproved = await Leave.countDocuments({
      status: 'Approved',
      startDate: { $lte: endOfTodayObj },
      endDate: { $gte: todayDateObj }
    });

    res.status(200).json({
      totalStaff,
      presentToday,
      absentToday,
      leavesApproved
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a new teacher
// @route   POST /api/admin/teachers
// @access  Private (Admin)
const createTeacher = async (req, res) => {
  try {
    const { name, employeeId, department, password, phone } = req.body;

    if (!name || !employeeId || !department || !password) {
      return res.status(400).json({ message: 'Name, Employee ID, Department, and Password are required' });
    }

    // Check if employeeId already exists
    const existing = await User.findOne({ employeeId });
    if (existing) {
      return res.status(400).json({ message: 'Employee ID already exists' });
    }

    // Password is auto-hashed by the User model pre-save hook
    const teacher = await User.create({
      name,
      employeeId,
      department,
      phone: phone || '',
      password,
      role: 'Teacher',
    });

    res.status(201).json({
      message: 'Teacher created successfully',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        employeeId: teacher.employeeId,
        department: teacher.department,
        phone: teacher.phone,
        role: teacher.role,
        isActive: teacher.isActive,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Employee ID already exists (Duplicate)' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all teachers
// @route   GET /api/admin/teachers
// @access  Private (Admin)
const getAllTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'Teacher' }).select('-__v').sort({ createdAt: -1 });
    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update teacher profile
// @route   PATCH /api/admin/teachers/:id
// @access  Private (Admin)
const updateTeacher = async (req, res) => {
  try {
    const { name, employeeId, department, phone, password } = req.body;

    const teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'Teacher') {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Update Employee ID if changed & verify uniqueness
    if (employeeId) {
      const newEmpId = employeeId.trim().toUpperCase();
      if (newEmpId !== teacher.employeeId) {
        const existing = await User.findOne({ employeeId: newEmpId, _id: { $ne: teacher._id } });
        if (existing) {
          return res.status(400).json({ message: `Employee ID "${newEmpId}" is already taken by another staff member.` });
        }
        teacher.employeeId = newEmpId;
      }
    }

    // Update other fields
    if (name !== undefined) teacher.name = name.trim();
    if (department !== undefined) teacher.department = department.trim();
    if (phone !== undefined) teacher.phone = phone.trim();
    // Only update password if a new one is explicitly provided
    if (password && password.trim().length >= 6) {
      teacher.password = password.trim(); // hashed by pre-save hook
    }

    await teacher.save();

    res.status(200).json({
      message: 'Teacher updated successfully',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        employeeId: teacher.employeeId,
        department: teacher.department,
        phone: teacher.phone,
        role: teacher.role,
        isActive: teacher.isActive,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Employee ID is already in use.' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Toggle teacher active status
// @route   PATCH /api/admin/teachers/:id/status
// @access  Private (Admin)
const toggleTeacherStatus = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'Teacher') {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    teacher.isActive = !teacher.isActive;
    await teacher.save();

    res.status(200).json({
      message: `Teacher ${teacher.isActive ? 'activated' : 'deactivated'} successfully`,
      teacher,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  markManualAttendance,
  getSettings,
  updateSettings,
  getDashboardStats,
  createTeacher,
  getAllTeachers,
  updateTeacher,
  toggleTeacherStatus,
};
