/**
 * ICMS Database Seeder
 * ---
 * Populates the database with initial Admin, Teacher, and Settings data.
 * Usage: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const SystemSettings = require('./models/SystemSettings');

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('🌱 Starting database seed...\n');

    // ── 1. Clear existing data ──────────────────────────────────────────────
    await User.deleteMany({});
    await SystemSettings.deleteMany({});
    console.log('   ✓ Cleared existing Users and SystemSettings');

    // ── 2. Create Admin user ────────────────────────────────────────────────
    // Password is auto-hashed by the User model's pre-save hook (bcrypt, 12 rounds)
    const admin = await User.create({
      name: 'Admin User',
      employeeId: 'ADMIN01',
      password: 'admin123',
      role: 'Admin',
      isActive: true,
    });
    console.log(`   ✓ Admin created  → employeeId: ${admin.employeeId}  |  password: admin123`);

    // ── 3. Create Teacher user ──────────────────────────────────────────────
    const teacher = await User.create({
      name: 'Ali Khan',
      employeeId: 'TCH01',
      password: 'teacher123',
      role: 'Teacher',
      isActive: true,
    });
    console.log(`   ✓ Teacher created → employeeId: ${teacher.employeeId}  |  password: teacher123`);

    // ── 4. Create initial SystemSettings ────────────────────────────────────
    const settings = await SystemSettings.create({
      requiredDailyHours: 6,
      allowedIPs: ['::1', '127.0.0.1', '::ffff:127.0.0.1'],
    });
    console.log(`   ✓ Settings created → requiredHours: ${settings.requiredDailyHours}  |  IPs: ${settings.allowedIPs.join(', ')}`);

    // ── Done ────────────────────────────────────────────────────────────────
    console.log('\n✅ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seedDatabase();
