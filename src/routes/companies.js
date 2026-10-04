const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { listCompanyAdmins, createCompanyAdmin, updateCompanyAdmin } = require('../controllers/companyController');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAdmin);

router.get('/', wrap(listCompanyAdmins));
router.post('/', wrap(createCompanyAdmin));
router.patch('/:id', wrap(updateCompanyAdmin));

module.exports = router;
