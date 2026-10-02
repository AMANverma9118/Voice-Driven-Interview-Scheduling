const express = require('express');
const router = express.Router();
const {
  getAllCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getMyProfile,
  saveMyProfile,
  adminResume,
} = require('../controllers/candidateController');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(getAllCandidates));
router.get('/:id/resume', wrap(adminResume));
router.get('/:id', wrap(getCandidateById));
router.post('/', wrap(createCandidate));
router.put('/:id', wrap(updateCandidate));
router.delete('/:id', wrap(deleteCandidate));

module.exports = router;
