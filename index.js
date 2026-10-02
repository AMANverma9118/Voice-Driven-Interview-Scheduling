const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./src/config/config');
const { connectDB, mongoose } = require('./src/config/database');
const requireDb = require('./src/middleware/requireDb');
const requireAuth = require('./src/middleware/requireAuth');
const requireAdmin = require('./src/middleware/requireAdmin');
const { ensureAdmin } = require('./src/services/bootstrap');
const { getMyProfile, saveMyProfile, myResume } = require('./src/controllers/candidateController');
const {
  listForAdmin,
  sendAsAdmin,
  listMine,
  notices,
  sendMine,
  acceptProposal,
} = require('./src/controllers/messageController');
const { speakNeural } = require('./src/services/neuralVoice');
const { transcribePcm } = require('./src/services/hear');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
      frameSrc: ["'self'", 'https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/'],
      connectSrc: ["'self'", 'https://www.google.com/recaptcha/'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      mediaSrc: ["'self'", 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
const clientOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
app.use(cors(clientOrigins.length ? { origin: clientOrigins } : {}));
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    ok: connected,
    database: connected ? 'mongodb' : 'disconnected',
  });
});

app.use('/api/auth', requireDb, require('./src/routes/auth'));
app.use('/api/settings', requireDb, require('./src/routes/settings'));
app.use('/api/users', requireDb, requireAuth, require('./src/routes/users'));
app.use('/api/jobs', requireDb, requireAuth, require('./src/routes/jobs'));
app.get('/api/me/profile', requireDb, requireAuth, (req, res, next) => Promise.resolve(getMyProfile(req, res)).catch(next));
app.put('/api/me/profile', requireDb, requireAuth, (req, res, next) => Promise.resolve(saveMyProfile(req, res)).catch(next));
app.get('/api/me/resume', requireDb, requireAuth, (req, res, next) => Promise.resolve(myResume(req, res)).catch(next));
app.get('/api/me/messages', requireDb, requireAuth, (req, res, next) => Promise.resolve(listMine(req, res)).catch(next));
app.get('/api/me/notices', requireDb, requireAuth, (req, res, next) => Promise.resolve(notices(req, res)).catch(next));
app.post('/api/me/messages', requireDb, requireAuth, (req, res, next) => Promise.resolve(sendMine(req, res)).catch(next));
app.post('/api/me/messages/:id/accept', requireDb, requireAuth, (req, res, next) => Promise.resolve(acceptProposal(req, res)).catch(next));
app.post('/api/me/speak', requireDb, requireAuth, async (req, res, next) => {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Nothing to say' });
    const audio = await speakNeural(text.slice(0, 500));
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    res.send(audio);
  } catch (error) {
    next(error);
  }
});
app.post('/api/me/hear', requireDb, requireAuth, async (req, res, next) => {
  try {
    const audio = req.body.audio;
    if (typeof audio !== 'string' || audio.length < 80) return res.json({ text: '' });
    const pcm = Buffer.from(audio, 'base64');
    if (pcm.length < 3200) return res.json({ text: '' });
    res.json({ text: await transcribePcm(pcm, req.body.kind === 'time' ? 'time' : '') });
  } catch (error) {
    next(error);
  }
});
app.get('/api/messages/:candidateId', requireDb, requireAuth, requireAdmin, (req, res, next) => Promise.resolve(listForAdmin(req, res)).catch(next));
app.post('/api/messages/:candidateId', requireDb, requireAuth, requireAdmin, (req, res, next) => Promise.resolve(sendAsAdmin(req, res)).catch(next));
app.use('/api/candidates', requireDb, requireAuth, requireAdmin, require('./src/routes/candidates'));
app.use('/api/appointments', requireDb, requireAuth, requireAdmin, require('./src/routes/appointments'));
app.use('/api/interviews', requireDb, requireAuth, require('./src/routes/interviews'));
app.use('/api/voice', requireDb, requireAuth, requireAdmin, require('./src/routes/voice'));
app.use('/api/calls', requireDb, requireAuth, requireAdmin, require('./src/routes/callRoutes'));

const clientDir = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDir));

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'That id is not valid' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong',
    details: err.message,
  });
});

process.on('SIGTERM', () => {
  try {
    require('./src/voice-agent/voiceAgentManager').cleanup();
  } catch (error) {
    console.error('Voice cleanup skipped:', error.message);
  }
  process.exit(0);
});

const PORT = config.server.port;

connectDB().then((connected) => {
  if (connected) return ensureAdmin();
}).finally(() => {
  app.listen(PORT, () => {
    console.log(`Interview Desk is running at http://localhost:${PORT}`);
  });
});
