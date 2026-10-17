const mongoose = require('mongoose');
require('dotenv').config();

const Admin = require('../models/Admin');

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'guythree1@gmail.com';
const NEW_PASSWORD = 'admin123';

async function resetPassword() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const admin = await Admin.findOne({ email: ADMIN_EMAIL });
    
    if (!admin) {
      console.log('❌ Admin not found with email:', ADMIN_EMAIL);
      process.exit(1);
    }

    console.log('🔄 Resetting password...');
    admin.password = NEW_PASSWORD; // Will be hashed by pre-save hook
    await admin.save();

    console.log('\n✅ Password reset successfully!');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email:', admin.email);
    console.log('🔑 New Password:', NEW_PASSWORD);
    console.log('═══════════════════════════════════════');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

resetPassword();