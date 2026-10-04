const express = require('express');
const { showCompany, joinRegister, joinLogin } = require('../controllers/joinController');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((error) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  return next(error);
});

router.get('/:slug', wrap(showCompany));
router.post('/:slug/register', wrap(joinRegister));
router.post('/:slug/login', wrap(joinLogin));

module.exports = router;
