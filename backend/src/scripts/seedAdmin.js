const mongoose = require('mongoose');
require('dotenv').config();

const Admin = require('../models/Admin');

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'guythree1@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function seedAdmin() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log('⚠️  Admin already exists!');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Name:', existingAdmin.name);
      console.log('🔑 Role:', existingAdmin.role);
      console.log('\nℹ️  You can login with:');
      console.log(`Email: ${ADMIN_EMAIL}`);
      console.log(`Password: ${ADMIN_PASSWORD}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('\n🔄 Creating new admin account...');

    // Create new admin (password will be hashed by the pre-save hook)
    const admin = new Admin({
      name: 'Super Admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD, // Will be hashed automatically
      role: 'super_admin',
      isActive: true,
    });

    await admin.save();

    console.log('\n✅ Admin created successfully!');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('👤 Name:', admin.name);
    console.log('🎭 Role:', admin.role);
    console.log('═══════════════════════════════════════');
    console.log('\n🎉 You can now login at: http://localhost:3000/login');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAdmin();