const voiceAgentManager = require('../voice-agent/voiceAgentManager');
const path = require('path');
const fs = require('fs');


const conductVoiceInterview = async (req, res) => {
  try {
    const { candidateId, jobId } = req.body;
    
    if (!candidateId || !jobId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'Both candidateId and jobId are required in the request body.',
        example: {
          "jobId": 10,
          "candidateId": 10
        }
      });
    }

    const soxPath = path.join(process.cwd(), 'sox-14.4.2', 'sox.exe');
    const resolvedPath = path.resolve(soxPath);
    const soxDir = path.dirname(resolvedPath);
    
    console.log('Checking Sox installation...');
    console.log('Current working directory:', process.cwd());
    console.log('Looking for Sox at:', resolvedPath);
    
    if (!fs.existsSync(soxDir)) {
      return res.status(503).json({
        error: 'Voice features are not available',
        details: `Sox directory not found at ${soxDir}. Please ensure Sox is installed in the correct location.`,
        troubleshooting: [
          '1. Download Sox from the official website',
          '2. Extract the Sox files to the sox-14.4.2 directory in your project root',
          '3. Ensure all required DLL files are present',
          '4. Set SOX_PATH environment variable if using a different location'
        ],
        debug: {
          workingDirectory: process.cwd(),
          soxPath: soxPath,
          resolvedPath: resolvedPath,
          soxDir: soxDir
        }
      });
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(503).json({
        error: 'Voice features are not available',
        details: `Sox executable not found at ${resolvedPath}. Please ensure Sox is installed correctly.`,
        troubleshooting: [
          '1. Check if sox.exe exists in the sox-14.4.2 directory',
          '2. Verify that all required DLL files are present',
          '3. Try reinstalling Sox if files are missing'
        ],
        debug: {
          workingDirectory: process.cwd(),
          soxPath: soxPath,
          resolvedPath: resolvedPath,
          directoryContents: fs.readdirSync(soxDir)
        }
      });
    }

    await voiceAgentManager.initialize();
    
    if (!voiceAgentManager.isInitialized) {
      return res.status(503).json({
        error: 'Voice features are not available',
        details: 'Failed to initialize voice agent. Please check the server logs for more details.',
        troubleshooting: [
          '1. Check if Sox is working correctly by running "sox --version" in command prompt',
          '2. Ensure microphone is connected and set as default recording device',
          '3. Check Windows Sound settings for microphone permissions'
        ]
      });
    }
    
    const agent = voiceAgentManager.getAgent();
    const results = await agent.conductInterview(candidateId, jobId);
    res.json(results);
  } catch (error) {
    console.error('Error in voice interview:', error);
    res.status(500).json({ 
      error: 'Failed to conduct interview', 
      details: error.message,
      troubleshooting: [
        '1. Check if Sox is installed and working correctly',
        '2. Verify microphone settings in Windows',
        '3. Check server logs for detailed error information'
      ]
    });
  }
};

const cleanup = () => {
  voiceAgentManager.cleanup();
  process.exit(0);
};

process.on('SIGTERM', cleanup);

module.exports = {
  conductVoiceInterview,
  cleanup
}; 