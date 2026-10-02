const mongoose = require('mongoose');
require('dotenv').config();

let connecting = null;

function mongoUri() {
  return process.env.MONGODB_URI || process.env.DATABASE_URL || '';
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

async function connectDB() {
  if (isConnected()) return true;

  const uri = mongoUri();
  if (!uri) {
    console.error('Set MONGODB_URI or DATABASE_URL in .env before starting the server.');
    return false;
  }

  if (!connecting) {
    connecting = mongoose
      .connect(uri, {
        dbName: process.env.DB_NAME || 'interview_scheduler',
        serverSelectionTimeoutMS: 12000,
      })
      .then(() => {
        console.log(`Connected to MongoDB (${mongoose.connection.name})`);
        return true;
      })
      .catch((error) => {
        connecting = null;
        console.error('MongoDB connection failed:', error.message);
        return false;
      });
  }

  return connecting;
}

module.exports = {
  mongoose,
  connectDB,
  isConnected,
};
