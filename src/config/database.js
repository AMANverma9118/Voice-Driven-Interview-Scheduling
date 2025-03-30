const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Neon-specific connection settings
  max: 10, // Reduce max connections
  idleTimeoutMillis: 10000, // Reduce idle timeout
  connectionTimeoutMillis: 5000, // Increase connection timeout
  maxRetries: 3, // Add retry attempts
  retryDelay: 1000, // Delay between retries in ms
});

// Test the connection with retries
async function testConnection() {
  let retries = 3;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      console.log('Successfully connected to PostgreSQL database');
      client.release();
      return;
    } catch (err) {
      retries--;
      console.error(`Connection attempt failed. Retries left: ${retries}`);
      if (retries === 0) {
        console.error('Failed to connect to database after multiple attempts:', err);
        throw err;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Run the connection test
testConnection().catch(err => {
  console.error('Database connection failed:', err);
});

module.exports = pool; 