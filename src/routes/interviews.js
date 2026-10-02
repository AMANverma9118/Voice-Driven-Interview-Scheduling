const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const {
  getAllInterviews,
  createInterview,
  listMyInterviews,
  myTurnAudio,
  adminTurnAudio,
} = require('../controllers/interviewController');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/mine', wrap(listMyInterviews));
router.get('/mine/:id/turns/:index/audio', wrap(myTurnAudio));
router.get('/', requireAdmin, wrap(getAllInterviews));
router.get('/:id/turns/:index/audio', requireAdmin, wrap(adminTurnAudio));
router.post('/', wrap(createInterview));

module.exports = router;
