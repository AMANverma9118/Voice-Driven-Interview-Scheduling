const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (email) {
    let user = await User.findOne({ email });
    if (!user) {
      if (password.length < 8) {
        console.log('Set ADMIN_PASSWORD in .env (at least 8 characters) so the admin account can be created.');
        return;
      }
      user = await User.create({
        name: 'Admin',
        email,
        passwordHash: await bcrypt.hash(password, 10),
        emailVerified: true,
        role: 'admin',
        revoked: false,
      });
      console.log(`Created admin ${email}`);
      return;
    }

    user.role = 'admin';
    user.revoked = false;
    user.emailVerified = true;
    if (password.length >= 8) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    await user.save();
    console.log(`Admin ready: ${email}`);
    return;
  }

  const admins = await User.countDocuments({ role: 'admin', revoked: { $ne: true } });
  if (admins > 0) return;
  const first = await User.findOne({ revoked: { $ne: true } }).sort({ createdAt: 1 });
  if (!first) return;
  first.role = 'admin';
  await first.save();
  console.log(`Promoted ${first.email} to admin`);
}

module.exports = { ensureAdmin };
