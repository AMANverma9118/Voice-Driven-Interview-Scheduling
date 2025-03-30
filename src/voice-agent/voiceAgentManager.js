const VoiceAgent = require('./voiceAgent');
const path = require('path');
const fs = require('fs');

class VoiceAgentManager {
  constructor() {
    if (!VoiceAgentManager.instance) {
      this.agent = new VoiceAgent();
      this.isInitialized = false;
      this.initializationPromise = null;
      this.initializationAttempts = 0;
      this.maxInitializationAttempts = 3;
      VoiceAgentManager.instance = this;
    }
    return VoiceAgentManager.instance;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Voice agent already initialized');
      return;
    }

    // If initialization is already in progress, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Check if Sox exists
    const soxPath = path.join(process.cwd(), 'sox-14.4.2', 'sox.exe');
    console.log('Checking Sox installation...');
    console.log('Current working directory:', process.cwd());
    console.log('Looking for Sox at:', soxPath);
    console.log('Environment variables:');
    console.log('SOX_PATH:', process.env.SOX_PATH);
    console.log('PATH:', process.env.PATH);
    
    // Try to resolve the path
    const resolvedPath = path.resolve(soxPath);
    console.log('Resolved Sox path:', resolvedPath);
    
    // Check if the directory exists
    const soxDir = path.dirname(resolvedPath);
    console.log('Sox directory:', soxDir);
    console.log('Directory exists:', fs.existsSync(soxDir));
    if (fs.existsSync(soxDir)) {
      console.log('Directory contents:', fs.readdirSync(soxDir));
    }
    
    if (!fs.existsSync(soxDir)) {
      console.warn(`Sox directory not found at ${soxDir}`);
      this.isInitialized = false;
      return;
    }
    
    // Check if the executable exists
    console.log('Executable exists:', fs.existsSync(resolvedPath));
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`Sox executable not found at ${resolvedPath}`);
      this.isInitialized = false;
      return;
    }

    // Set Sox path in environment
    process.env.SOX_PATH = resolvedPath;
    process.env.PATH = `${soxDir};${process.env.PATH}`;
    console.log('Sox found and configured successfully');
    console.log('Updated PATH:', process.env.PATH);

    this.initializationPromise = this._initializeWithRetry();
    return this.initializationPromise;
  }

  async _initializeWithRetry() {
    while (this.initializationAttempts < this.maxInitializationAttempts) {
      try {
        console.log(`Initializing voice agent (attempt ${this.initializationAttempts + 1}/${this.maxInitializationAttempts})...`);
        await this.agent.init();
        this.isInitialized = true;
        this.initializationAttempts = 0;
        console.log('Voice agent initialized successfully');
        return;
      } catch (error) {
        this.initializationAttempts++;
        console.error(`Failed to initialize voice agent (attempt ${this.initializationAttempts}/${this.maxInitializationAttempts}):`, error);
        
        if (this.initializationAttempts >= this.maxInitializationAttempts) {
          console.warn('Voice features will be disabled due to initialization failure');
          this.isInitialized = false;
          return;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * this.initializationAttempts));
      }
    }
  }

  getAgent() {
    if (!this.isInitialized) {
      throw new Error('Voice features are not available. Please check if Sox is installed and properly configured.');
    }
    return this.agent;
  }

  cleanup() {
    if (this.agent) {
      this.agent.cleanup();
      this.isInitialized = false;
      this.initializationPromise = null;
      this.initializationAttempts = 0;
    }
  }
}

// Create and export a singleton instance
const voiceAgentManager = new VoiceAgentManager();
module.exports = voiceAgentManager; 