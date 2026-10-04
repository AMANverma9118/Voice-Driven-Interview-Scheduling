const Message = require('../models/Message');
const Candidate = require('../models/Candidate');
const Appointment = require('../models/Appointment');
const calendarService = require('../services/calendarService');
const { rememberTime } = require('../services/notice');
const { isId, text } = require('../utils/validate');

function shapeMessage(doc, viewerId) {
  return {
    id: doc._id.toString(),
    body: doc.body,
    proposed_time: doc.proposedTime,
    author_role: doc.authorRole,
    mine: String(doc.author) === String(viewerId),
    created_at: doc.createdAt,
  };
}

function proposedTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'That time is not valid' };
  return { value: date };
}

async function candidateForUser(userId, companyId) {
  return Candidate.findOne({ user: userId, company: companyId });
}

async function loadThread(candidateId) {
  return Message.find({ candidate: candidateId }).sort({ createdAt: 1 });
}

const listForAdmin = async (req, res) => {
  if (!isId(req.params.candidateId)) return res.status(400).json({ error: 'Choose a person first' });
  const candidate = await Candidate.findOne({ _id: req.params.candidateId, company: req.user.companyId });
  if (!candidate) return res.status(404).json({ error: 'Person not found' });
  if (!candidate.user) {
    return res.status(400).json({ error: 'This person has no account, so there is no one to write to' });
  }
  const rows = await loadThread(candidate._id);
  res.json(rows.map((row) => shapeMessage(row, req.user.id)));
};

const sendAsAdmin = async (req, res) => {
  if (!isId(req.params.candidateId)) return res.status(400).json({ error: 'Choose a person first' });
  const body = text(req.body.body);
  if (!body) return res.status(400).json({ error: 'Write a message first' });
  const when = proposedTime(req.body.proposed_time);
  if (when && when.error) return res.status(400).json({ error: when.error });

  const candidate = await Candidate.findOne({ _id: req.params.candidateId, company: req.user.companyId });
  if (!candidate) return res.status(404).json({ error: 'Person not found' });
  if (!candidate.user) {
    return res.status(400).json({ error: 'This person has no account, so there is no one to write to' });
  }

  const message = await Message.create({
    company: candidate.company,
    candidate: candidate._id,
    author: req.user.id,
    authorRole: 'admin',
    body,
    proposedTime: when ? when.value : null,
  });
  res.status(201).json(shapeMessage(message, req.user.id));
};

const listMine = async (req, res) => {
  const candidate = await candidateForUser(req.user.id, req.user.companyId);
  if (!candidate) return res.json([]);
  const rows = await loadThread(candidate._id);
  await Message.updateMany(
    { candidate: candidate._id, authorRole: 'admin', seen: false },
    { seen: true }
  );
  res.json(rows.map((row) => shapeMessage(row, req.user.id)));
};

const notices = async (req, res) => {
  const candidate = await candidateForUser(req.user.id, req.user.companyId);
  if (!candidate) return res.json({ unread: 0, latest: '' });
  const rows = await Message.find({
    candidate: candidate._id,
    authorRole: 'admin',
    seen: false,
  }).sort({ createdAt: -1 }).limit(8);
  res.json({
    unread: rows.length,
    items: rows.map((row) => ({
      id: row._id.toString(),
      body: row.body,
      created_at: row.createdAt,
    })),
  });
};

const sendMine = async (req, res) => {
  const body = text(req.body.body);
  if (!body) return res.status(400).json({ error: 'Write a message first' });
  const candidate = await candidateForUser(req.user.id, req.user.companyId);
  if (!candidate) return res.status(400).json({ error: 'Save your details before you write to the desk' });

  const message = await Message.create({
    company: candidate.company,
    candidate: candidate._id,
    author: req.user.id,
    authorRole: 'candidate',
    body,
  });
  res.status(201).json(shapeMessage(message, req.user.id));
};

const acceptProposal = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'That message is missing' });
  const candidate = await candidateForUser(req.user.id, req.user.companyId);
  const message = await Message.findById(req.params.id);
  if (!candidate || !message || String(message.candidate) !== String(candidate._id)) {
    return res.status(404).json({ error: 'That message is missing' });
  }
  if (!message.proposedTime || message.authorRole !== 'admin') {
    return res.status(400).json({ error: 'There is no new time to accept' });
  }

  const appointment = await Appointment.findOne({
    candidate: candidate._id,
    status: 'scheduled',
  }).sort({ date_time: 1 });
  if (!appointment) return res.status(400).json({ error: 'There is no interview on the book to move' });

  appointment.date_time = message.proposedTime;
  if (appointment.calendar_event_id) {
    try {
      const end = new Date(message.proposedTime);
      end.setHours(end.getHours() + 1);
      await calendarService.updateEvent(appointment.calendar_event_id, {
        start: { dateTime: message.proposedTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: end.toISOString(), timeZone: 'UTC' },
      });
    } catch (error) {
      console.error('Calendar sync failed:', error.message);
    }
  }
  await appointment.save();
  await rememberTime(appointment._id, candidate._id, message.proposedTime);

  const reply = await Message.create({
    company: candidate.company,
    candidate: candidate._id,
    author: req.user.id,
    authorRole: 'candidate',
    body: 'That time works for me.',
  });
  res.json(shapeMessage(reply, req.user.id));
};

module.exports = {
  listForAdmin,
  sendAsAdmin,
  listMine,
  notices,
  sendMine,
  acceptProposal,
};
