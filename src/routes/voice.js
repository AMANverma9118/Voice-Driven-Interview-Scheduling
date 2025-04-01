const express = require('express');
const router = express.Router();
const { conductVoiceInterview } = require('../controllers/voiceController');

router.post('/interview', conductVoiceInterview);

process.on('SIGTERM', () => {
  process.exit(0);
});

module.exports = router; 