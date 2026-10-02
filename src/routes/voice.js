const express = require('express');
const router = express.Router();

async function runInterview(req, res) {
  const { conductVoiceInterview } = require('../controllers/voiceController');
  return conductVoiceInterview(req, res);
}

router.post('/interview', (req, res, next) => {
  runInterview(req, res).catch(next);
});

router.post('/start-interview', (req, res, next) => {
  runInterview(req, res).catch(next);
});

module.exports = router;
