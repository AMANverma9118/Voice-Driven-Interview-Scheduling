const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Company = require('../models/Company');
const Settings = require('../models/Settings');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Appointment = require('../models/Appointment');
const Message = require('../models/Message');
const InterviewResult = require('../models/InterviewResult');
const { uniqueSlug } = require('../utils/slug');

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (email) {
    let user = await User.findOne({ email });
    if (!user) {
      if (password.length < 8) {
        console.log('Set ADMIN_PASSWORD in .env (at least 8 characters) so the admin account can be created.');
        return null;
      }
      user = await User.create({
        name: 'Admin',
        email,
        passwordHash: await bcrypt.hash(password, 10),
        emailVerified: true,
        role: 'admin',
        platform: true,
        revoked: false,
      });
      console.log(`Created admin ${email}`);
      return user;
    }

    user.role = 'admin';
    user.platform = true;
    user.revoked = false;
    user.emailVerified = true;
    if (password.length >= 8) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    await user.save();
    console.log(`Admin ready: ${email}`);
    return user;
  }

  const admins = await User.countDocuments({ role: 'admin', revoked: { $ne: true } });
  if (admins > 0) return User.findOne({ role: 'admin', revoked: { $ne: true } }).sort({ createdAt: 1 });
  const first = await User.findOne({ revoked: { $ne: true } }).sort({ createdAt: 1 });
  if (!first) return null;
  first.role = 'admin';
  await first.save();
  console.log(`Promoted ${first.email} to admin`);
  return first;
}

async function relaxEmailIndex() {
  const indexes = await User.collection.indexes();
  const emailIndex = indexes.find((item) => item.key && item.key.email === 1 && Object.keys(item.key).length === 1 && item.unique);
  if (emailIndex) await User.collection.dropIndex(emailIndex.name);
}

async function ensureSlugs() {
  const { uniqueSlug } = require('../utils/slug');
  const companies = await Company.find({ $or: [{ slug: null }, { slug: '' }, { slug: { $exists: false } }] });
  for (const company of companies) {
    company.slug = await uniqueSlug(company.name, company._id);
    await company.save();
  }
}
async function relaxSettingsIndex() {
  const indexes = await Settings.collection.indexes();
  const keyIndex = indexes.find((item) => item.key && item.key.key === 1 && Object.keys(item.key).length === 1 && item.unique);
  if (keyIndex) await Settings.collection.dropIndex(keyIndex.name);
}

async function claimExisting(companyId) {
  const missing = null;
  await User.updateMany({ company: missing }, { company: companyId });
  await Job.updateMany({ company: missing }, { company: companyId });
  await Candidate.updateMany({ company: missing }, { company: companyId });
  await Appointment.updateMany({ company: missing }, { company: companyId });
  await Message.updateMany({ company: missing }, { company: companyId });
  await InterviewResult.updateMany({ company: missing }, { company: companyId });
  await Settings.updateMany({ company: missing }, { company: companyId });
}

async function ensureCompany() {
  const admin = await ensureAdmin();
  if (!admin) return;

  try {
    await relaxSettingsIndex();
    await relaxEmailIndex();
  } catch (error) {
    console.error('Settings index:', error.message);
  }

  let company = admin.company ? await Company.findById(admin.company) : null;
  if (!company) {
    const current = await Settings.findOne().sort({ createdAt: 1 });
    company = await Company.create({
      name: current?.companyName || process.env.COMPANY_NAME || 'Interview Desk',
      slug: await uniqueSlug(current?.companyName || process.env.COMPANY_NAME || 'Interview Desk'),
    });
    admin.company = company._id;
    await admin.save();
    console.log(`Company ready: ${company.name}`);
  }

  await claimExisting(company._id);
  await ensureSlugs();

  const settings = await Settings.findOne({ company: company._id });
  if (!settings) {
    await Settings.create({
      company: company._id,
      companyName: company.name,
      key: `company-${company._id}`,
    });
  }
}

module.exports = { ensureAdmin: ensureCompany };
