const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['admin', 'candidate'], required: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    proposedTime: { type: Date, default: null },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
