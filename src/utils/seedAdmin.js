require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function seed() {
  await connectDB();

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@navycashless.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`[seed] admin already exists: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({
      name: 'Super Admin',
      email,
      passwordHash,
      role: 'super_admin',
      isActive: true,
    });
    console.log(`[seed] created super_admin: ${email} / ${password}`);
    console.log('[seed] change this password immediately after first login.');
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
