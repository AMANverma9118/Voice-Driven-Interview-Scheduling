const pool = require('../config/database');

// Get all jobs
const getAllJobs = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// Get a specific job
const getJobById = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

// Create a new job
const createJob = async (req, res) => {
  try {
    const { title, description, requirements } = req.body;
    
    const { rows } = await pool.query(
      'INSERT INTO jobs (title, description, requirements) VALUES ($1, $2, $3) RETURNING *',
      [title, description, requirements]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job', details: error.message });
  }
};

// Update a job
const updateJob = async (req, res) => {
  try {
    const { title, description, requirements } = req.body;
    
    const { rows } = await pool.query(
      'UPDATE jobs SET title = $1, description = $2, requirements = $3 WHERE id = $4 RETURNING *',
      [title, description, requirements, req.params.id]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Failed to update job', details: error.message });
  }
};

// Delete a job
const deleteJob = async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM jobs WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job', details: error.message });
  }
};

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob
}; 