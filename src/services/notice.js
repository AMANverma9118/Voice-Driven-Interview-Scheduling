const Message = require('../models/Message');
const User = require('../models/User');
const InterviewResult = require('../models/InterviewResult');
const { sendTimeNotice } = require('./mailer');

function whenLabel(date) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

async function rememberTime(appointmentId, candidateId, when) {
  if (appointmentId) {
    const updated = await InterviewResult.updateOne(
      { appointment: appointmentId },
      { available_date: when }
    );
    if (updated.matchedCount) return;
  }
  if (!candidateId) return;
  const latest = await InterviewResult.findOne({ candidate: candidateId, confirmed: true }).sort({ createdAt: -1 });
  if (latest) {
    latest.available_date = when;
    await latest.save();
  }
}

async function tellCandidate({ candidate, authorId, when, appointmentId }) {
  await rememberTime(appointmentId, candidate._id, when);
  if (!candidate.user) return 'no-account';

  const label = whenLabel(when);
  await Message.create({
    candidate: candidate._id,
    author: authorId,
    authorRole: 'admin',
    body: `The desk moved your interview to ${label}.`,
    seen: false,
  });

  const user = await User.findById(candidate.user);
  if (user && user.email) {
    try {
      await sendTimeNotice(user.email, label);
    } catch (error) {
      console.error('Time notice email failed:', error.message);
    }
  }
  return 'sent';
}

module.exports = { rememberTime, tellCandidate, whenLabel };
