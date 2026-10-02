const { isConnected } = require('../config/database');

function requireDb(req, res, next) {
  if (!isConnected()) {
    return res.status(503).json({
      error: 'Database is not connected',
      details: 'Check MONGODB_URI or DATABASE_URL in .env and that the cluster allows this network.',
    });
  }
  next();
}

module.exports = requireDb;
