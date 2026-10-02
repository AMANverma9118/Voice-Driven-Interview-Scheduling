const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob
} = require('../controllers/jobController');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(getAllJobs));
router.get('/:id', wrap(getJobById));
router.post('/', requireAdmin, wrap(createJob));
router.put('/:id', requireAdmin, wrap(updateJob));
router.delete('/:id', requireAdmin, wrap(deleteJob));

module.exports = router; 