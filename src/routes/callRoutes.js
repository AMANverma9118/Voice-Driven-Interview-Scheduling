const express = require('express');
const { makeCall } = require('../telephony/twilioClient');

const router = express.Router();

// Helper function to validate phone numbers
function isValidPhoneNumber(number) {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
  return phoneRegex.test(number);
}

// Define the route for making a call
router.post('/make-call', (req, res) => {
  const { to, from, url } = req.body;

  if (!to || !from || !url) {
    return res.status(400).json({ error: 'Missing required parameters: to, from, url' });
  }

  if (!isValidPhoneNumber(to) || !isValidPhoneNumber(from)) {
    return res.status(400).json({ error: 'Invalid phone number format. Please use E.164 format.' });
  }

  makeCall(to, from, url)
    .then(() => res.status(200).json({ message: 'Call initiated successfully' }))
    .catch(error => {
      console.error('Error making call:', error);
      res.status(500).json({ error: 'Failed to initiate call', details: error.message });
    });
});

module.exports = router; 