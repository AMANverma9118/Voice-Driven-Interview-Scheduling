const pool = require('../config/database');

// Get all candidates
const getAllCandidates = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM candidates ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
};

// Get a specific candidate
const getCandidateById = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM candidates WHERE id = $1', [req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
};

// Create a new candidate
const createCandidate = async (req, res) => {
  try {
    const { name, phone, email, current_ctc, expected_ctc, notice_period, experience_years } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO candidates 
       (name, phone, email, current_ctc, expected_ctc, notice_period, experience_years) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, phone, email, current_ctc, expected_ctc, notice_period, experience_years]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ error: 'Failed to create candidate', details: error.message });
  }
};

// Update a candidate
const updateCandidate = async (req, res) => {
  try {
    const { name, phone, email, current_ctc, expected_ctc, notice_period, experience_years } = req.body;
    
    const { rows } = await pool.query(
      `UPDATE candidates 
       SET name = $1, phone = $2, email = $3, current_ctc = $4, expected_ctc = $5, 
           notice_period = $6, experience_years = $7, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $8 RETURNING *`,
      [name, phone, email, current_ctc, expected_ctc, notice_period, experience_years, req.params.id]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ error: 'Failed to update candidate', details: error.message });
  }
};

// Delete a candidate
const deleteCandidate = async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM candidates WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json({ message: 'Candidate deleted successfully', deletedCandidate: rows[0] });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ error: 'Failed to delete candidate', details: error.message });
  }
};

module.exports = {
  getAllCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate
}; 