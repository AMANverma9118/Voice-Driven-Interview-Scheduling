const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  register,
  verifyEmail,
  resend,
  login,
  me,
  publicConfig,
} = require('../controllers/authController');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((error) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  return next(error);
});

router.get('/config', wrap(publicConfig));
router.post('/register', wrap(register));
router.post('/verify', wrap(verifyEmail));
router.post('/resend', wrap(resend));
router.post('/login', wrap(login));
router.get('/me', requireAuth, wrap(me));

module.exports = router;
