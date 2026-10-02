const mongoose = require('mongoose');

function isId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function num(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = { isId, num, text };
