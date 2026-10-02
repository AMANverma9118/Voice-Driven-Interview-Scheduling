const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    date_time: { type: Date, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    calendar_event_id: { type: String, default: null },
    notes: { type: String, trim: true, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ date_time: 1 });
appointmentSchema.index({ candidate: 1, date_time: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
