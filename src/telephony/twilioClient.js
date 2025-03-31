const twilio = require('twilio');

// Your Account SID and Auth Token from twilio.com/console
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Create a Twilio client
const client = new twilio(accountSid, authToken);

/**
 * Make a voice call using Twilio
 * @param {string} to - The phone number to call
 * @param {string} from - Your Twilio phone number
 * @param {string} url - The URL for Twilio to fetch instructions
 */
function makeCall(to, from, url) {
  return client.calls
    .create({
      url: url,
      to: to,
      from: from
    })
    .then(call => {
      console.log('Call initiated:', call.sid);
      return call;
    })
    .catch(error => {
      console.error('Error making call:', error);
      throw error;
    });
}

module.exports = { makeCall }; 