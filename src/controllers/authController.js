const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const assertCaptcha = require('../middleware/captcha');
const { hashToken, makeToken, sendVerification } = require('../services/mailer');
const { text } = require('../utils/validate');

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET is not set');
    error.status = 500;
    throw error;
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name, role: user.role || 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role || 'candidate',
    platform: Boolean(user.platform),
    revoked: Boolean(user.revoked),
  };
}

async function accountView(user) {
  let company = user.company;
  if (company && !company.slug) company = await Company.findById(company);
  return {
    ...publicUser(user),
    companyName: company?.name || '',
    companySlug: company?.slug || '',
  };
}

async function usersMatching(email, password, companyId) {
  const query = { email };
  if (companyId) query.company = companyId;
  const users = email ? await User.find(query) : [];
  const matches = [];
  for (const user of users) {
    if (await bcrypt.compare(password, user.passwordHash)) matches.push(user);
  }
  return matches;
}

async function issueSession(user) {
  return { token: signToken(user), user: await accountView(user) };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function issueVerification(user) {
  const { token, hash } = makeToken();
  user.verificationTokenHash = hash;
  user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  return sendVerification(user.email, token);
}

const register = async (req, res) => {
  res.status(403).json({ error: 'The desk owner creates each company admin. Sign in when you have an account.' });
};

const verifyEmail = async (req, res) => {
  const token = text(req.body.token || req.query.token);
  if (!token) return res.status(400).json({ error: 'Missing verification token' });

  const user = await User.findOne({
    verificationTokenHash: hashToken(token),
    verificationExpires: { $gt: new Date() },
  });
  if (!user) {
    return res.status(400).json({ error: 'This link is invalid or has expired' });
  }

  user.emailVerified = true;
  user.verificationTokenHash = null;
  user.verificationExpires = null;
  await user.save();
  res.json({
    message: 'Email verified.',
    ...(await issueSession(user)),
  });
};

const resend = async (req, res) => {
  await assertCaptcha(req.body.captchaToken);
  const email = text(req.body.email).toLowerCase();
  const user = email ? await User.findOne({ email }) : null;
  let verificationUrl;

  if (user && !user.emailVerified) {
    const delivery = await issueVerification(user);
    if (!delivery.sent) verificationUrl = delivery.url;
  }

  res.json({
    message: 'If that account exists and is not verified, a new link is ready.',
    verificationUrl,
  });
};

const login = async (req, res) => {
  await assertCaptcha(req.body.captchaToken);
  const email = text(req.body.email).toLowerCase();
  const password = req.body.password || '';
  const matches = await usersMatching(email, password);

  if (!matches.length) {
    return res.status(401).json({ error: 'Email or password is wrong' });
  }
  if (matches.length > 1) {
    return res.status(409).json({
      error: 'This email is on more than one company. Open that company link to sign in.',
    });
  }
  const user = matches[0];
  if (user.revoked) {
    return res.status(403).json({ error: 'This account has been revoked' });
  }
  if (!user.emailVerified) {
    return res.status(403).json({
      error: 'Verify your email before signing in',
      code: 'unverified',
    });
  }

  res.json(await issueSession(user));
};

const me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ error: 'Sign in again' });
  res.json(await accountView(user));
};

module.exports = {
  register,
  verifyEmail,
  resend,
  login,
  me,
  validEmail,
  usersMatching,
  issueSession,
};
