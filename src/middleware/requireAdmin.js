function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only an admin can do that' });
  }
  next();
}

module.exports = requireAdmin;
