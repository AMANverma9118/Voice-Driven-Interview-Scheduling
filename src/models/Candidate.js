const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    current_ctc: { type: Number, default: null },
    expected_ctc: { type: Number, default: null },
    notice_period: { type: Number, default: null },
    experience_years: { type: Number, default: null },
    status: {
      type: String,
      enum: ['new', 'screened', 'scheduled', 'declined'],
      default: 'new',
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resume_name: { type: String, trim: true, default: '' },
    resume_type: { type: String, trim: true, default: '' },
    resume: { type: Buffer, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Candidate', candidateSchema);
