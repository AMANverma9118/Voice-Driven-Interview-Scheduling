const InterviewResult = require('../models/InterviewResult');
const Appointment = require('../models/Appointment');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const calendarService = require('../services/calendarService');
const { shapeInterview } = require('../utils/shape');
const { pcmToWav } = require('../utils/wav');
const { isId, num, text } = require('../utils/validate');

function interviewQuery(companyId) {
  return InterviewResult.find({ company: companyId })
    .select('-turns.audio')
    .populate('job', 'title')
    .populate('candidate', 'name')
    .sort({ createdAt: -1 });
}

function readTurns(body) {
  if (!Array.isArray(body.turns)) return [];
  return body.turns.slice(0, 12).map((turn) => {
    const prompt = text(turn.prompt).slice(0, 500);
    const answer = text(turn.answer).slice(0, 500);
    let audio = null;
    if (typeof turn.audio === 'string' && turn.audio.length > 80) {
      const pcm = Buffer.from(turn.audio, 'base64');
      if (pcm.length >= 3200 && pcm.length <= 800000) audio = pcmToWav(pcm);
    }
    return { prompt, answer, audio, recorded: Boolean(audio) };
  }).filter((turn) => turn.prompt || turn.answer);
}

const getAllInterviews = async (req, res) => {
  const rows = await interviewQuery(req.user.companyId);
  res.json(rows.map(shapeInterview));
};

const createInterview = async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'The candidate files this from their own interview' });
  }
  const jobId = req.body.job_id || req.body.jobId;
  const interested = Boolean(req.body.interested);
  const confirmed = Boolean(req.body.confirmed);
  const availableRaw = req.body.available_date || req.body.availableDate || null;
  const availableDate = availableRaw ? new Date(availableRaw) : null;
  const isAdmin = req.user.role === 'admin';

  if (!isId(jobId)) {
    return res.status(400).json({ error: 'Choose a role' });
  }
  if (availableRaw && Number.isNaN(availableDate.getTime())) {
    return res.status(400).json({ error: 'The interview time is not valid' });
  }
  if (confirmed && !availableDate) {
    return res.status(400).json({ error: 'A confirmed call needs a time' });
  }

  const job = await Job.findOne({ _id: jobId, company: req.user.companyId, status: 'open' });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  let candidate;
  if (isAdmin) {
    const candidateId = req.body.candidate_id || req.body.candidateId;
    if (!isId(candidateId)) return res.status(400).json({ error: 'Choose both a person and a role' });
    candidate = await Candidate.findOne({ _id: candidateId, company: req.user.companyId });
  } else {
    const phone = text(req.body.phone) || 'not given';
    candidate = await Candidate.findOne({ user: req.user.id, company: req.user.companyId });
    if (!candidate) {
      candidate = await Candidate.create({
        name: req.user.name,
        email: req.user.email,
        phone,
        owner: job.owner || req.user.id,
        user: req.user.id,
        company: req.user.companyId,
        status: 'new',
      });
    } else if (text(req.body.phone)) {
      candidate.phone = text(req.body.phone);
    }
  }
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  const notice = num(req.body.notice_period ?? req.body.noticePeriod);
  const currentCtc = num(req.body.current_ctc ?? req.body.currentCtc);
  const expectedCtc = num(req.body.expected_ctc ?? req.body.expectedCtc);
  const experience = num(req.body.experience_years ?? req.body.experienceYears);

  if (notice !== null) candidate.notice_period = notice;
  if (currentCtc !== null) candidate.current_ctc = currentCtc;
  if (expectedCtc !== null) candidate.expected_ctc = expectedCtc;
  if (experience !== null) candidate.experience_years = experience;

  let appointment = null;
  let calendarError = null;

  if (interested && confirmed && availableDate) {
    const clash = await Appointment.findOne({
      candidate: candidate._id,
      status: { $ne: 'cancelled' },
      date_time: {
        $gte: new Date(availableDate.getTime() - 60 * 60 * 1000),
        $lt: new Date(availableDate.getTime() + 60 * 60 * 1000),
      },
    });
    if (clash) {
      return res.status(409).json({
        error: `${candidate.name} already has an interview within an hour of that time`,
      });
    }

    let calendarEventId = null;
    try {
      const end = new Date(availableDate);
      end.setHours(end.getHours() + 1);
      const event = await calendarService.createEvent(
        `Interview: ${job.title}`,
        `Interview with ${candidate.name} for ${job.title}`,
        availableDate.toISOString(),
        end.toISOString()
      );
      calendarEventId = event.id;
    } catch (error) {
      console.error('Calendar sync failed:', error.message);
      calendarError = 'Calendar was not updated. The interview is still saved here.';
    }

    appointment = await Appointment.create({
      job: job._id,
      candidate: candidate._id,
      date_time: availableDate,
      status: 'scheduled',
      calendar_event_id: calendarEventId,
      notes: text(req.body.notes),
      owner: req.user.id,
      company: req.user.companyId,
    });
    candidate.status = 'scheduled';
  } else if (!interested) {
    candidate.status = 'declined';
  } else {
    candidate.status = 'screened';
  }

  await candidate.save();

  const interview = await InterviewResult.create({
    candidate: candidate._id,
    job: job._id,
    interested,
    notice_period: notice,
    current_ctc: currentCtc,
    expected_ctc: expectedCtc,
    available_date: availableDate,
    confirmed: interested && confirmed,
    notes: text(req.body.notes),
    source: req.body.source === 'voice' ? 'voice' : 'screen',
    appointment: appointment ? appointment._id : null,
    turns: readTurns(req.body),
    owner: req.user.id,
    company: req.user.companyId,
  });

  const saved = await InterviewResult.findById(interview._id)
    .populate('job', 'title')
    .populate('candidate', 'name');

  res.status(201).json({
    ...shapeInterview(saved),
    calendar_error: calendarError,
  });
};

const listMyInterviews = async (req, res) => {
  const candidate = await Candidate.findOne({ user: req.user.id, company: req.user.companyId });
  if (!candidate) return res.json([]);
  const rows = await InterviewResult.find({ candidate: candidate._id, company: req.user.companyId })
    .select('-turns.audio')
    .populate('job', 'title')
    .populate('candidate', 'name')
    .sort({ createdAt: -1 });
  res.json(rows.map(shapeInterview));
};

async function sendTurnAudio(interview, index, res) {
  const turn = interview.turns[index];
  if (!turn || !turn.audio || !turn.audio.length) {
    return res.status(404).json({ error: 'That recording is missing' });
  }
  res.set('Content-Type', 'audio/wav');
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(turn.audio);
}

const myTurnAudio = async (req, res) => {
  const index = Number(req.params.index);
  if (!isId(req.params.id) || !Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'That recording is missing' });
  }
  const candidate = await Candidate.findOne({ user: req.user.id, company: req.user.companyId });
  const interview = await InterviewResult.findOne({ _id: req.params.id, company: req.user.companyId });
  if (!candidate || !interview || String(interview.candidate) !== String(candidate._id)) {
    return res.status(404).json({ error: 'That recording is missing' });
  }
  return sendTurnAudio(interview, index, res);
};

const adminTurnAudio = async (req, res) => {
  const index = Number(req.params.index);
  if (!isId(req.params.id) || !Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'That recording is missing' });
  }
  const interview = await InterviewResult.findOne({ _id: req.params.id, company: req.user.companyId });
  if (!interview) return res.status(404).json({ error: 'That recording is missing' });
  return sendTurnAudio(interview, index, res);
};

module.exports = {
  getAllInterviews,
  createInterview,
  listMyInterviews,
  myTurnAudio,
  adminTurnAudio,
};
