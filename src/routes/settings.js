const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(getSettings));
router.put('/', requireAuth, requireAdmin, wrap(updateSettings));

module.exports = router;
