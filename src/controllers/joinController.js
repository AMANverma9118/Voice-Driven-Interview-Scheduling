const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Company = require('../models/Company');
const Candidate = require('../models/Candidate');
const assertCaptcha = require('../middleware/captcha');
const { validEmail, usersMatching, issueSession } = require('./authController');
const { text } = require('../utils/validate');

async function loadCompany(slug) {
  const key = text(slug).toLowerCase();
  if (!key) return null;
  return Company.findOne({ slug: key });
}

const showCompany = async (req, res) => {
  const company = await loadCompany(req.params.slug);
  if (!company) return res.status(404).json({ error: 'That company link is not valid' });
  res.json({ name: company.name, slug: company.slug });
};

const joinRegister = async (req, res) => {
  await assertCaptcha(req.body.captchaToken);
  const company = await loadCompany(req.params.slug);
  if (!company) return res.status(404).json({ error: 'That company link is not valid' });

  const name = text(req.body.name);
  const email = text(req.body.email).toLowerCase();
  const password = req.body.password || '';
  const phone = text(req.body.phone);

  if (!name || !validEmail(email)) {
    return res.status(400).json({ error: 'Name and a valid email are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Use at least 8 characters for the password' });
  }
  if (phone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ error: 'Add a phone number' });
  }

  const existing = await User.findOne({ email, company: company._id });
  if (existing) {
    return res.status(409).json({ error: 'You already have an account with this company. Sign in on this page.' });
  }

  const admin = await User.findOne({ company: company._id, role: 'admin', revoked: { $ne: true } });
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    emailVerified: true,
    role: 'candidate',
    company: company._id,
  });
  await Candidate.create({
    name,
    email,
    phone,
    user: user._id,
    owner: admin ? admin._id : user._id,
    company: company._id,
    status: 'new',
  });

  res.status(201).json(await issueSession(user));
};

const joinLogin = async (req, res) => {
  await assertCaptcha(req.body.captchaToken);
  const company = await loadCompany(req.params.slug);
  if (!company) return res.status(404).json({ error: 'That company link is not valid' });

  const email = text(req.body.email).toLowerCase();
  const password = req.body.password || '';
  const matches = await usersMatching(email, password, company._id);
  if (!matches.length) {
    return res.status(401).json({ error: 'Email or password is wrong for this company' });
  }
  const user = matches[0];
  if (user.revoked) return res.status(403).json({ error: 'This account has been revoked' });
  if (!user.emailVerified) {
    return res.status(403).json({ error: 'Verify your email before signing in', code: 'unverified' });
  }
  if (user.role === 'admin') {
    return res.status(403).json({ error: 'Admins sign in from the desk login' });
  }
  res.json(await issueSession(user));
};

module.exports = { showCompany, joinRegister, joinLogin };
