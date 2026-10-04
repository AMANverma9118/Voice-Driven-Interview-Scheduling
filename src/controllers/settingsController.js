const Settings = require('../models/Settings');
const Company = require('../models/Company');
const { text } = require('../utils/validate');

const DEFAULTS = {
  companyName: 'Interview Desk',
  logo: '',
  paper: '#efe8dc',
  ink: '#221e1a',
  brick: '#8f3d2b',
  rail: '#221e1a',
};

function shape(doc, fallbackName) {
  return {
    companyName: doc?.companyName || fallbackName || DEFAULTS.companyName,
    logo: doc?.logo || '',
    paper: doc?.paper || DEFAULTS.paper,
    ink: doc?.ink || DEFAULTS.ink,
    brick: doc?.brick || DEFAULTS.brick,
    rail: doc?.rail || DEFAULTS.rail,
  };
}

function isColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

const getSettings = async (req, res) => {
  if (!req.user?.companyId) return res.json(shape(null));
  const [doc, company] = await Promise.all([
    Settings.findOne({ company: req.user.companyId }),
    Company.findById(req.user.companyId),
  ]);
  res.json(shape(doc, company?.name));
};

const updateSettings = async (req, res) => {
  if (!req.user.companyId) {
    return res.status(403).json({ error: 'This account is not on a company desk' });
  }
  const companyName = text(req.body.companyName).slice(0, 80) || DEFAULTS.companyName;
  const logo = typeof req.body.logo === 'string' ? req.body.logo : '';
  if (logo && !logo.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Logo must be an image' });
  }
  if (logo.length > 1_500_000) {
    return res.status(400).json({ error: 'Logo is too large. Use an image under about 1 MB.' });
  }

  const colors = {};
  for (const key of ['paper', 'ink', 'brick', 'rail']) {
    const value = text(req.body[key]) || DEFAULTS[key];
    if (!isColor(value)) return res.status(400).json({ error: `${key} needs a colour like #8f3d2b` });
    colors[key] = value;
  }

  const doc = await Settings.findOneAndUpdate(
    { company: req.user.companyId },
    { company: req.user.companyId, companyName, logo, ...colors, key: `company-${req.user.companyId}` },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await Company.updateOne({ _id: req.user.companyId }, { name: companyName });
  res.json(shape(doc));
};

module.exports = { getSettings, updateSettings };
