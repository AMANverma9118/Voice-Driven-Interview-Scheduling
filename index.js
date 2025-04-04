const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./src/config/config");
const voiceAgentManager = require("./src/voice-agent/voiceAgentManager");
const callRoutes = require('./src/routes/callRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/jobs", require("./src/routes/jobs"));
app.use("/api/candidates", require("./src/routes/candidates"));
app.use("/api/appointments", require("./src/routes/appointments"));
app.use("/api/voice", require("./src/routes/voice"));
app.use('/api/calls', callRoutes);

app.get("/", (req, res) => {
  res.send("Voice-Driven Interview Scheduler API");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
  });
});

process.on('SIGTERM', () => {
  voiceAgentManager.cleanup();
  process.exit(0);
});

const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

