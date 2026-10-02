const Job = require('../models/Job');
const { shapeJob } = require('../utils/shape');
const { text } = require('../utils/validate');

function jobPayload(body) {
  const title = text(body.title);
  const description = text(body.description);
  const requirements = text(body.requirements);
  const missing = [];
  if (!title) missing.push('title');
  if (!description) missing.push('description');
  if (!requirements) missing.push('requirements');
  if (missing.length) {
    return { error: `Missing ${missing.join(', ')}` };
  }

  const status = body.status === 'closed' ? 'closed' : 'open';
  return {
    value: {
      title,
      description,
      requirements,
      department: text(body.department),
      location: text(body.location),
      status,
    },
  };
}

const getAllJobs = async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { status: 'open' };
  const jobs = await Job.find(filter).sort({ createdAt: -1 });
  res.json(jobs.map(shapeJob));
};

const getJobById = async (req, res) => {
  const filter = req.user.role === 'admin'
    ? { _id: req.params.id }
    : { _id: req.params.id, status: 'open' };
  const job = await Job.findOne(filter);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(shapeJob(job));
};

const createJob = async (req, res) => {
  const parsed = jobPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const job = await Job.create({ ...parsed.value, owner: req.user.id });
  res.status(201).json(shapeJob(job));
};

const updateJob = async (req, res) => {
  const parsed = jobPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const job = await Job.findOneAndUpdate(
    { _id: req.params.id },
    parsed.value,
    { new: true, runValidators: true }
  );
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(shapeJob(job));
};

const deleteJob = async (req, res) => {
  const job = await Job.findOneAndDelete({ _id: req.params.id });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ message: 'Job deleted successfully' });
};

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
};
