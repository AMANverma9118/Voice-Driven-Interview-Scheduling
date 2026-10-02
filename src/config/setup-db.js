const { connectDB } = require('./database');
const User = require('../models/User');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Appointment = require('../models/Appointment');
const InterviewResult = require('../models/InterviewResult');

async function setupDatabase() {
  const connected = await connectDB();
  if (!connected) {
    throw new Error('Could not connect to MongoDB');
  }

  await Promise.all([
    User.syncIndexes(),
    Job.syncIndexes(),
    Candidate.syncIndexes(),
    Appointment.syncIndexes(),
    InterviewResult.syncIndexes(),
  ]);

  console.log('MongoDB indexes are in place');
}

setupDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Setup failed:', error.message);
    process.exit(1);
  });
