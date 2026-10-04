const Candidate = require('../models/Candidate');
const { shapeCandidate } = require('../utils/shape');
const { num, text } = require('../utils/validate');

function readResume(payload) {
  if (payload === undefined) return { skip: true };
  if (payload === null || payload === '') return { clear: true };
  if (!payload || typeof payload.data !== 'string' || typeof payload.name !== 'string') {
    return { error: 'That resume could not be read' };
  }
  const name = payload.name.replace(/[\\/]/g, '').trim().slice(0, 180);
  const ext = name.split('.').pop().toLowerCase();
  if (!['pdf', 'doc', 'docx'].includes(ext)) {
    return { error: 'Upload a PDF or Word resume' };
  }
  const buffer = Buffer.from(payload.data, 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
    return { error: 'The resume must be under 4 MB' };
  }
  const pdf = buffer.subarray(0, 5).toString() === '%PDF-';
  const zip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const ole = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  if (ext === 'pdf' && !pdf) return { error: 'That file is not a PDF' };
  if (ext === 'docx' && !zip) return { error: 'That file is not a Word document' };
  if (ext === 'doc' && !ole) return { error: 'That file is not a Word document' };
  const mime = pdf
    ? 'application/pdf'
    : ole
      ? 'application/msword'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return { value: { resume: buffer, resume_name: name, resume_type: mime } };
}

function applyResume(candidate, file) {
  if (file.clear) {
    candidate.resume = null;
    candidate.resume_name = '';
    candidate.resume_type = '';
  } else if (file.value) {
    candidate.resume = file.value.resume;
    candidate.resume_name = file.value.resume_name;
    candidate.resume_type = file.value.resume_type;
  }
}

function sendResume(res, candidate) {
  if (!candidate || !candidate.resume || !candidate.resume.length) {
    return res.status(404).json({ error: 'No resume on file' });
  }
  const name = (candidate.resume_name || 'resume').replace(/"/g, '');
  res.set('Content-Type', candidate.resume_type || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${name}"`);
  res.send(candidate.resume);
}

const STATUSES = ['new', 'screened', 'scheduled', 'declined'];

function candidatePayload(body) {
  const name = text(body.name);
  const phone = text(body.phone);
  if (!name || !phone) {
    return { error: 'Name and phone are required' };
  }

  const email = text(body.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Email does not look right' };
  }

  const status = STATUSES.includes(body.status) ? body.status : 'new';
  return {
    value: {
      name,
      phone,
      email,
      current_ctc: num(body.current_ctc),
      expected_ctc: num(body.expected_ctc),
      notice_period: num(body.notice_period),
      experience_years: num(body.experience_years),
      status,
    },
  };
}

const getAllCandidates = async (req, res) => {
  const candidates = await Candidate.find({ company: req.user.companyId }).select('-resume').sort({ createdAt: -1 });
  res.json(candidates.map(shapeCandidate));
};

const getCandidateById = async (req, res) => {
  const candidate = await Candidate.findOne({ _id: req.params.id, company: req.user.companyId }).select('-resume');
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(shapeCandidate(candidate));
};

const createCandidate = async (req, res) => {
  const parsed = candidatePayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const candidate = await Candidate.create({ ...parsed.value, owner: req.user.id, company: req.user.companyId });
  res.status(201).json(shapeCandidate(candidate));
};

const getMyProfile = async (req, res) => {
  const candidate = await Candidate.findOne({ user: req.user.id, company: req.user.companyId }).select('-resume');
  res.json(candidate ? shapeCandidate(candidate) : null);
};

const saveMyProfile = async (req, res) => {
  const parsed = candidatePayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const file = readResume(req.body.resume);
  if (file.error) return res.status(400).json({ error: file.error });
  const details = { ...parsed.value };
  delete details.status;
  let candidate = await Candidate.findOne({ user: req.user.id, company: req.user.companyId });
  if (!candidate) {
    candidate = new Candidate({
      ...details,
      status: 'new',
      user: req.user.id,
      owner: req.user.id,
      company: req.user.companyId,
    });
    applyResume(candidate, file);
    await candidate.save();
    return res.status(201).json(shapeCandidate(candidate));
  }
  Object.assign(candidate, details);
  applyResume(candidate, file);
  await candidate.save();
  res.json(shapeCandidate(candidate));
};

const myResume = async (req, res) => {
  const candidate = await Candidate.findOne({ user: req.user.id, company: req.user.companyId });
  return sendResume(res, candidate);
};

const adminResume = async (req, res) => {
  const candidate = await Candidate.findOne({ _id: req.params.id, company: req.user.companyId });
  return sendResume(res, candidate);
};

const updateCandidate = async (req, res) => {
  const parsed = candidatePayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const candidate = await Candidate.findOneAndUpdate(
    { _id: req.params.id, company: req.user.companyId },
    parsed.value,
    { new: true, runValidators: true }
  );
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(shapeCandidate(candidate));
};

const deleteCandidate = async (req, res) => {
  const candidate = await Candidate.findOneAndDelete({ _id: req.params.id, company: req.user.companyId });
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json({
    message: 'Candidate deleted successfully',
    deletedCandidate: shapeCandidate(candidate),
  });
};

module.exports = {
  getAllCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getMyProfile,
  saveMyProfile,
  myResume,
  adminResume,
};
