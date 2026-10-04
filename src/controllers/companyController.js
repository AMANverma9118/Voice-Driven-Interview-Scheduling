const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Company = require('../models/Company');
const Settings = require('../models/Settings');
const { text } = require('../utils/validate');
const { uniqueSlug } = require('../utils/slug');

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shapeAdmin(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    company: user.company?.name || '',
    slug: user.company?.slug || '',
    revoked: Boolean(user.revoked),
  };
}

function ownerOnly(req, res) {
  if (req.user?.platform) return false;
  res.status(403).json({ error: 'Only the desk owner can create a company admin' });
  return true;
}

const listCompanyAdmins = async (req, res) => {
  if (ownerOnly(req, res)) return;
  const admins = await User.find({ role: 'admin', platform: { $ne: true } })
    .populate('company', 'name slug')
    .sort({ createdAt: -1 });
  res.json(admins.map(shapeAdmin));
};

const createCompanyAdmin = async (req, res) => {
  if (ownerOnly(req, res)) return;
  const companyName = text(req.body.companyName).slice(0, 80);
  const name = text(req.body.name);
  const email = text(req.body.email).toLowerCase();
  const password = req.body.password || '';

  if (!companyName) return res.status(400).json({ error: 'Name the company' });
  if (!name || !validEmail(email)) return res.status(400).json({ error: 'Name and a valid email are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Use at least 8 characters for the password' });

  const existing = await User.findOne({ email, role: 'admin' });
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const company = await Company.create({ name: companyName, slug: await uniqueSlug(companyName) });
  try {
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      emailVerified: true,
      role: 'admin',
      platform: false,
      company: company._id,
    });
    await Settings.create({
      company: company._id,
      companyName,
      key: `company-${company._id}`,
    });
    user.company = company;
    res.status(201).json(shapeAdmin(user));
  } catch (error) {
    await User.deleteOne({ email, company: company._id });
    await Settings.deleteOne({ company: company._id });
    await Company.deleteOne({ _id: company._id });
    throw error;
  }
};

const updateCompanyAdmin = async (req, res) => {
  if (ownerOnly(req, res)) return;
  const user = await User.findOne({ _id: req.params.id, role: 'admin', platform: { $ne: true } }).populate('company', 'name slug');
  if (!user) return res.status(404).json({ error: 'That admin was not found' });
  if (req.body.revoked !== undefined) user.revoked = Boolean(req.body.revoked);
  await user.save();
  res.json(shapeAdmin(user));
};

module.exports = { listCompanyAdmins, createCompanyAdmin, updateCompanyAdmin };
