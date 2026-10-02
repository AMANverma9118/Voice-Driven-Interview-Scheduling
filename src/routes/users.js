const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { listUsers, createUser, updateUser } = require('../controllers/userController');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', requireAdmin, wrap(listUsers));
router.post('/', requireAdmin, wrap(createUser));
router.patch('/:id', requireAdmin, wrap(updateUser));

module.exports = router;
