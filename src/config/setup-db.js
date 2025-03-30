const fs = require('fs');
const path = require('path');
const pool = require('./database');

async function setupDatabase() {
  let client;
  let retries = 3;
  
  while (retries > 0) {
    try {
      // Get a client from the pool
      client = await pool.connect();
      console.log('Connected to database');

      // Read the schema file
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      // Begin transaction
      await client.query('BEGIN');
      console.log('Transaction started');

      // Split the schema into individual statements and execute them
      const statements = schema
        .split(';')
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);

      for (const statement of statements) {
        try {
          if (statement) {
            await client.query(statement);
            console.log('Executed:', statement.substring(0, 50) + '...');
          }
        } catch (error) {
          console.error('Error executing statement:', error.message);
          console.error('Statement:', statement);
          throw error;
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      console.log('Transaction committed successfully');
      console.log('Database setup completed successfully!');
      return;
    } catch (error) {
      console.error('Error during database setup:', error);
      
      // Rollback transaction if we have a client
      if (client) {
        try {
          await client.query('ROLLBACK');
          console.log('Transaction rolled back');
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
      }
      
      retries--;
      if (retries === 0) {
        throw error;
      }
      console.log(`Retrying... ${retries} attempts left`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      // Release the client back to the pool
      if (client) {
        client.release();
        console.log('Client released back to pool');
      }
    }
  }
}

// Run the setup
console.log('Starting database setup...');
setupDatabase()
  .then(() => {
    console.log('Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  }); 