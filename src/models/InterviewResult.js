const mongoose = require('mongoose');

const interviewResultSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    interested: { type: Boolean, required: true },
    notice_period: { type: Number, default: null },
    current_ctc: { type: Number, default: null },
    expected_ctc: { type: Number, default: null },
    available_date: { type: Date, default: null },
    confirmed: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: '' },
    source: { type: String, enum: ['screen', 'voice'], default: 'screen' },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    turns: [{
      prompt: { type: String, default: '' },
      answer: { type: String, default: '' },
      audio: { type: Buffer, default: null },
      recorded: { type: Boolean, default: false },
    }],
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewResult', interviewResultSchema);
