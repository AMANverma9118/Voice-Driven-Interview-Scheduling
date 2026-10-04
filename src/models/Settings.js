const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'desk' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, unique: true, sparse: true },
    companyName: { type: String, default: 'Interview Desk', trim: true },
    logo: { type: String, default: '' },
    paper: { type: String, default: '#efe8dc' },
    ink: { type: String, default: '#221e1a' },
    brick: { type: String, default: '#8f3d2b' },
    rail: { type: String, default: '#221e1a' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
