const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    requirements: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', jobSchema);
