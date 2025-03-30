const express = require('express');
const router = express.Router();
const { conductVoiceInterview } = require('../controllers/voiceController');

// Conduct voice interview
router.post('/interview', conductVoiceInterview);

// Clean up when the API shuts down
process.on('SIGTERM', () => {
  process.exit(0);
});

module.exports = router; 