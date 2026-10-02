const jwt = require('jsonwebtoken');
const User = require('../models/User');

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Sign in again' });
  }
  if (!payload.sub) {
    return res.status(401).json({ error: 'Sign in again' });
  }

  User.findById(payload.sub)
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'Sign in again' });
      if (user.revoked) return res.status(401).json({ error: 'This account has been revoked' });
      req.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || 'candidate',
      };
      return next();
    })
    .catch(next);
}

module.exports = requireAuth;
