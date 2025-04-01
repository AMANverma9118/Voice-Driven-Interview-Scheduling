const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },

  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  maxRetries: 3,
  retryDelay: 1000, 
});

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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

testConnection().catch(err => {
  console.error('Database connection failed:', err);
});

module.exports = pool; 