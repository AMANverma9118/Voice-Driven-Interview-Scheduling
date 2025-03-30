require('dotenv').config();

module.exports = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'interview_scheduler',
    port: process.env.DB_PORT || 3306
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