const Settings = require('../models/Settings');
const { text } = require('../utils/validate');

const DEFAULTS = {
  companyName: 'Interview Desk',
  logo: '',
  paper: '#efe8dc',
  ink: '#221e1a',
  brick: '#8f3d2b',
  rail: '#221e1a',
};

function shape(doc) {
  return {
    companyName: doc?.companyName || DEFAULTS.companyName,
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
  const doc = await Settings.findOne({ key: 'desk' });
  res.json(shape(doc));
};

const updateSettings = async (req, res) => {
  const companyName = text(req.body.companyName) || DEFAULTS.companyName;
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
    { key: 'desk' },
    { key: 'desk', companyName, logo, ...colors },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json(shape(doc));
};

module.exports = { getSettings, updateSettings };
