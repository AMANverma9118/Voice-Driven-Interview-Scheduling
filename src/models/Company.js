const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
