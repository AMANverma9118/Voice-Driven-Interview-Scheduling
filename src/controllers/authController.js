const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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
    revoked: Boolean(user.revoked),
  };
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
  await assertCaptcha(req.body.captchaToken);
  const name = text(req.body.name);
  const email = text(req.body.email).toLowerCase();
  const password = req.body.password || '';

  if (!name || !validEmail(email)) {
    return res.status(400).json({ error: 'Name and a valid email are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Use at least 8 characters for the password' });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const user = new User({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    emailVerified: false,
  });
  const delivery = await issueVerification(user);

  res.status(201).json({
    message: delivery.sent
      ? 'Account created. Check your email to verify it.'
      : 'Account created. Email is not configured on this server, so use the verification link below.',
    email: user.email,
    verificationUrl: delivery.sent ? undefined : delivery.url,
  });
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
    token: signToken(user),
    user: publicUser(user),
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
  const user = email ? await User.findOne({ email }) : null;
  const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !matches) {
    return res.status(401).json({ error: 'Email or password is wrong' });
  }
  if (user.revoked) {
    return res.status(403).json({ error: 'This account has been revoked' });
  }
  if (!user.emailVerified) {
    return res.status(403).json({
      error: 'Verify your email before signing in',
      code: 'unverified',
    });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
};

const me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ error: 'Sign in again' });
  res.json(publicUser(user));
};

module.exports = { register, verifyEmail, resend, login, me };
