const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { text } = require('../utils/validate');

function shapeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role || 'candidate',
    revoked: Boolean(user.revoked),
    created_at: user.createdAt,
  };
}

const listUsers = async (req, res) => {
  const users = await User.find({ company: req.user.companyId }).sort({ createdAt: 1 });
  res.json(users.map(shapeUser));
};

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const createUser = async (req, res) => {
  const name = text(req.body.name);
  const email = text(req.body.email).toLowerCase();
  const password = req.body.password || '';

  if (!name || !validEmail(email)) {
    return res.status(400).json({ error: 'Name and a valid email are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Use at least 8 characters for the password' });
  }

  if (!req.user.companyId) {
    return res.status(403).json({ error: 'This account is not on a company desk' });
  }
  if (req.body.role === 'admin') {
    return res.status(403).json({ error: 'The desk owner creates each company admin' });
  }

  const existing = await User.findOne({ email, company: req.user.companyId });
  if (existing) {
    return res.status(409).json({ error: 'This company already has an account with that email' });
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    emailVerified: true,
    role: 'candidate',
    company: req.user.companyId,
  });
  res.status(201).json(shapeUser(user));
};

const updateUser = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, company: req.user.companyId });
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.body.role !== undefined && req.body.role !== user.role) {
    return res.status(403).json({ error: 'The desk owner creates each company admin' });
  }

  if (req.body.revoked !== undefined) {
    const revoked = Boolean(req.body.revoked);
    if (revoked && user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'You cannot revoke your own account' });
    }
    if (revoked && user.role === 'admin') {
      const others = await User.countDocuments({
        company: req.user.companyId,
        role: 'admin',
        revoked: { $ne: true },
        _id: { $ne: user._id },
      });
      if (others === 0) {
        return res.status(400).json({ error: 'Keep at least one admin for this company' });
      }
    }
    user.revoked = revoked;
  }

  await user.save();
  res.json(shapeUser(user));
};

module.exports = { listUsers, createUser, updateUser };
