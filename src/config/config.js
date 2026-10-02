require('dotenv').config();

module.exports = {
  database: {
    uri: process.env.MONGODB_URI || process.env.DATABASE_URL || '',
    name: process.env.DB_NAME || 'interview_scheduler',
  },
  server: {
    port: process.env.PORT || 3000
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  google: {
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    credentials: process.env.GOOGLE_CREDENTIALS
  }
}; 