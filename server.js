require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// ─── App Initialization ───────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

// ─── Global Middleware ────────────────────────────────────────────────────────

// CORS — Only allow requests from the designated frontend (SRS §4.1)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate Limiter — Prevent brute-force login attacks (SRS §4.1)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ─── Base Route ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the ICMS Backend API! 🚀',
    healthCheck: '/api/health'
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// TODO: Uncomment as each route module is implemented
app.use('/api/auth',       require('./routes/authRoutes'));
app.use('/api/user',       require('./routes/userRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/leaves',     require('./routes/leaveRoutes'));
app.use('/api/admin',      require('./routes/adminRoutes'));
app.use('/api/settings',   require('./routes/settingsRoutes'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'ICMS Attendance API is running 🚀',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 ICMS Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
