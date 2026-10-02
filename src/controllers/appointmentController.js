const Appointment = require('../models/Appointment');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const calendarService = require('../services/calendarService');
const { tellCandidate } = require('../services/notice');
const { shapeAppointment } = require('../utils/shape');
const { isId, text } = require('../utils/validate');

const STATUSES = ['scheduled', 'completed', 'cancelled'];

function listQuery(owner) {
  return Appointment.find()
    .populate('job', 'title')
    .populate('candidate', 'name')
    .sort({ date_time: 1 });
}

async function findClash(candidateId, dateTime, ignoreId, ownerId) {
  const start = new Date(dateTime);
  const windowStart = new Date(start.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(start.getTime() + 60 * 60 * 1000);
  const query = {
    candidate: candidateId,
    status: { $ne: 'cancelled' },
    date_time: { $gte: windowStart, $lt: windowEnd },
  };
  if (ignoreId) query._id = { $ne: ignoreId };
  return Appointment.findOne(query);
}

async function syncCalendar(action, details) {
  try {
    if (action === 'create') {
      const end = new Date(details.dateTime);
      end.setHours(end.getHours() + 1);
      const event = await calendarService.createEvent(
        `Interview: ${details.jobTitle}`,
        `Interview with ${details.candidateName} for ${details.jobTitle}`,
        new Date(details.dateTime).toISOString(),
        end.toISOString()
      );
      return { id: event.id, error: null };
    }

    if (action === 'update' && details.eventId) {
      const end = new Date(details.dateTime);
      end.setHours(end.getHours() + 1);
      await calendarService.updateEvent(details.eventId, {
        start: { dateTime: new Date(details.dateTime).toISOString(), timeZone: 'UTC' },
        end: { dateTime: end.toISOString(), timeZone: 'UTC' },
      });
      return { id: details.eventId, error: null };
    }

    if (action === 'delete' && details.eventId) {
      await calendarService.deleteEvent(details.eventId);
      return { id: null, error: null };
    }

    return { id: details.eventId || null, error: null };
  } catch (error) {
    console.error('Calendar sync failed:', error.message);
    return {
      id: action === 'create' ? null : details.eventId || null,
      error: 'Calendar was not updated. The interview is still saved here.',
    };
  }
}

const getAllAppointments = async (req, res) => {
  const rows = await listQuery(req.user.id);
  res.json(rows.map(shapeAppointment));
};

const getAppointmentById = async (req, res) => {
  const row = await Appointment.findOne({ _id: req.params.id })
    .populate('job', 'title')
    .populate('candidate', 'name');
  if (!row) return res.status(404).json({ error: 'Appointment not found' });
  res.json(shapeAppointment(row));
};

const createAppointment = async (req, res) => {
  const { job_id, candidate_id, date_time } = req.body;
  const status = STATUSES.includes(req.body.status) ? req.body.status : 'scheduled';

  if (!isId(job_id) || !isId(candidate_id) || !date_time) {
    return res.status(400).json({ error: 'Job, candidate, and date are required' });
  }

  const when = new Date(date_time);
  if (Number.isNaN(when.getTime())) {
    return res.status(400).json({ error: 'Date is not valid' });
  }

  const job = await Job.findById(job_id);
  const candidate = await Candidate.findById(candidate_id);
  if (!job || !candidate) {
    return res.status(404).json({ error: 'Job or candidate not found' });
  }

  const clash = await findClash(candidate_id, when, null, req.user.id);
  if (clash) {
    return res.status(409).json({
      error: `${candidate.name} already has an interview within an hour of that time`,
    });
  }

  const calendar = await syncCalendar('create', {
    dateTime: when,
    jobTitle: job.title,
    candidateName: candidate.name,
  });

  const appointment = await Appointment.create({
    job: job._id,
    candidate: candidate._id,
    date_time: when,
    status,
    calendar_event_id: calendar.id,
    notes: text(req.body.notes),
    owner: req.user.id,
  });

  if (status === 'scheduled') {
    candidate.status = 'scheduled';
    await candidate.save();
  }

  const saved = await Appointment.findById(appointment._id)
    .populate('job', 'title')
    .populate('candidate', 'name');

  res.status(201).json({
    ...shapeAppointment(saved),
    calendar_error: calendar.error,
  });
};

const updateAppointment = async (req, res) => {
  const existing = await Appointment.findOne({ _id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });

  const jobId = req.body.job_id || existing.job.toString();
  const candidateId = req.body.candidate_id || existing.candidate.toString();
  const when = new Date(req.body.date_time || existing.date_time);
  const status = STATUSES.includes(req.body.status) ? req.body.status : existing.status;

  if (!isId(jobId) || !isId(candidateId) || Number.isNaN(when.getTime())) {
    return res.status(400).json({ error: 'Job, candidate, and a valid date are required' });
  }

  const job = await Job.findById(jobId);
  const candidate = await Candidate.findById(candidateId);
  if (!job || !candidate) {
    return res.status(404).json({ error: 'Job or candidate not found' });
  }

  const clash = await findClash(candidateId, when, existing._id, req.user.id);
  if (clash && status !== 'cancelled') {
    return res.status(409).json({
      error: `${candidate.name} already has an interview within an hour of that time`,
    });
  }

  let calendarError = null;
  let calendarEventId = existing.calendar_event_id;
  const previousTime = new Date(existing.date_time);
  if (req.body.date_time && calendarEventId) {
    const calendar = await syncCalendar('update', {
      eventId: calendarEventId,
      dateTime: when,
    });
    calendarError = calendar.error;
    calendarEventId = calendar.id;
  }

  existing.job = job._id;
  existing.candidate = candidate._id;
  existing.date_time = when;
  existing.status = status;
  existing.calendar_event_id = calendarEventId;
  if (req.body.notes !== undefined) existing.notes = text(req.body.notes);
  await existing.save();

  const moved = Boolean(req.body.date_time)
    && Math.floor(when.getTime() / 60000) !== Math.floor(previousTime.getTime() / 60000);
  let notice = null;
  if (moved) {
    try {
      notice = await tellCandidate({
        candidate,
        authorId: req.user.id,
        when,
        appointmentId: existing._id,
      });
    } catch (error) {
      console.error('Time notice failed:', error.message);
      notice = 'failed';
    }
  }

  const saved = await Appointment.findById(existing._id)
    .populate('job', 'title')
    .populate('candidate', 'name');

  res.json({
    ...shapeAppointment(saved),
    calendar_error: calendarError,
    notice,
  });
};

const deleteAppointment = async (req, res) => {
  const existing = await Appointment.findOne({ _id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });

  let calendarError = null;
  if (existing.calendar_event_id) {
    const calendar = await syncCalendar('delete', { eventId: existing.calendar_event_id });
    calendarError = calendar.error;
  }

  await existing.deleteOne();
  res.json({
    message: 'Appointment deleted successfully',
    calendar_error: calendarError,
  });
};

module.exports = {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
};
