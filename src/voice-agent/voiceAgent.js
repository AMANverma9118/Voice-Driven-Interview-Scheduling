const { NlpManager } = require('node-nlp');
const say = require('say');
const vosk = require('vosk');
const wav = require('wav');
const record = require('node-record-lpcm16');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class VoiceAgent {
  constructor() {
    this.nlpManager = new NlpManager({ languages: ['en'] });
    this.model = null;
    this.recognizer = null;
    this.isInitialized = false;
    this.numberWords = {
      'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
      'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000
    };
  }

  async init() {
    if (this.isInitialized) {
      console.log('Voice agent already initialized');
      return;
    }

    try {
      // Setup NLP
      await this.setupNLP();
      
      // Initialize Vosk model
      const modelPath = path.resolve(process.cwd(), process.env.VOSK_MODEL_PATH);
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Vosk model not found at ${modelPath}. Please download the model and set VOSK_MODEL_PATH environment variable.`);
      }
      
      console.log('Initializing Vosk model from:', modelPath);
      vosk.setLogLevel(-1); // Disable logging
      
      // Create model and recognizer
      this.model = new vosk.Model(modelPath);
      if (!this.model) {
        throw new Error('Failed to create Vosk model');
      }
      
      this.recognizer = new vosk.Recognizer({ model: this.model, sampleRate: 16000 });
      if (!this.recognizer) {
        throw new Error('Failed to create Vosk recognizer');
      }
      
      console.log('Vosk model initialized successfully');

      // Set sox path and check audio devices
      const soxPath = process.env.SOX_PATH || path.join(process.cwd(), 'sox-14.4.2', 'sox.exe');
      if (!fs.existsSync(soxPath)) {
        throw new Error(`Sox not found at ${soxPath}. Please set SOX_PATH environment variable to your sox.exe location.`);
      }
      process.env.PATH = `${path.dirname(soxPath)};${process.env.PATH}`;

      // Check for audio devices
      await this.checkAudioDevices();
      
      this.isInitialized = true;
      console.log('Voice agent initialized successfully');
    } catch (error) {
      console.error('Error initializing voice agent:', error);
      this.cleanup(); // Clean up any partially initialized resources
      throw error;
    }
  }

  async checkAudioDevices() {
    return new Promise((resolve, reject) => {
      // First try using Windows' built-in audio device enumeration
      const powershellProcess = spawn('powershell', [
        '-Command',
        'Get-WmiObject Win32_SoundDevice | Where-Object { $_.ConfigManagerErrorCode -eq 0 -and $_.StatusInfo -eq 3 } | Select-Object Name, DeviceID'
      ]);

      let devices = '';

      powershellProcess.stdout.on('data', (data) => {
        devices += data.toString();
      });

      powershellProcess.stderr.on('data', (data) => {
        console.warn('PowerShell warning:', data.toString());
      });

      powershellProcess.on('close', (code) => {
        if (code !== 0) {
          console.warn('Failed to list audio devices using PowerShell, falling back to default device');
          // Fall back to using default device
          this.defaultAudioDevice = { id: '-d', name: 'Default Audio Device' };
          resolve();
          return;
        }

        // Parse PowerShell output
        const lines = devices.split('\n');
        const audioDevices = [];

        for (const line of lines) {
          if (line.trim() && !line.includes('Name') && !line.includes('----')) {
            audioDevices.push({ id: '-d', name: line.trim() });
          }
        }

        if (audioDevices.length === 0) {
          console.warn('No audio devices found using PowerShell, falling back to default device');
          this.defaultAudioDevice = { id: '-d', name: 'Default Audio Device' };
        } else {
          this.defaultAudioDevice = audioDevices[0];
          console.log('Using audio device:', this.defaultAudioDevice.name);
        }
        resolve();
      });

      powershellProcess.on('error', (error) => {
        console.warn('Failed to execute PowerShell command:', error);
        // Fall back to using default device
        this.defaultAudioDevice = { id: '-d', name: 'Default Audio Device' };
        resolve();
      });
    });
  }

  setupNLP() {
    // Interest responses
    this.nlpManager.addDocument('en', 'yes', 'intent.interest');
    this.nlpManager.addDocument('en', 'yeah', 'intent.interest');
    this.nlpManager.addDocument('en', 'sure', 'intent.interest');
    this.nlpManager.addDocument('en', 'of course', 'intent.interest');
    this.nlpManager.addDocument('en', 'definitely', 'intent.interest');
    this.nlpManager.addDocument('en', 'i am interested', 'intent.interest');
    this.nlpManager.addDocument('en', 'sounds good', 'intent.interest');
    this.nlpManager.addDocument('en', 'i would like to', 'intent.interest');

    this.nlpManager.addDocument('en', 'no', 'intent.not_interested');
    this.nlpManager.addDocument('en', 'nope', 'intent.not_interested');
    this.nlpManager.addDocument('en', 'not interested', 'intent.not_interested');
    this.nlpManager.addDocument('en', 'not at this time', 'intent.not_interested');
    this.nlpManager.addDocument('en', 'i will pass', 'intent.not_interested');

    // Notice period responses with both numeric and word numbers
    this.nlpManager.addDocument('en', 'my notice period is %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', '%number% days notice', 'intent.notice_period');
    this.nlpManager.addDocument('en', '%number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'it is %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'around %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', '%number% days notice period', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'notice period of %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'my notice period is %number%', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'i have %number% days notice', 'intent.notice_period');

    // CTC responses with both numeric and word numbers
    this.nlpManager.addDocument('en', 'my current ctc is %number% lakhs', 'intent.current_ctc');
    this.nlpManager.addDocument('en', 'i make %number% lakhs', 'intent.current_ctc');
    this.nlpManager.addDocument('en', 'currently %number% lakhs', 'intent.current_ctc');
    this.nlpManager.addDocument('en', 'current salary is %number% lakhs', 'intent.current_ctc');
    this.nlpManager.addDocument('en', '%number% lakhs currently', 'intent.current_ctc');
    this.nlpManager.addDocument('en', 'my current salary is %number% lakhs', 'intent.current_ctc');
    this.nlpManager.addDocument('en', 'i am earning %number% lakhs', 'intent.current_ctc');

    this.nlpManager.addDocument('en', 'my expected ctc is %number% lakhs', 'intent.expected_ctc');
    this.nlpManager.addDocument('en', 'i expect %number% lakhs', 'intent.expected_ctc');
    this.nlpManager.addDocument('en', 'looking for %number% lakhs', 'intent.expected_ctc');
    this.nlpManager.addDocument('en', 'expecting %number% lakhs', 'intent.expected_ctc');
    this.nlpManager.addDocument('en', '%number% lakhs expected', 'intent.expected_ctc');
    this.nlpManager.addDocument('en', 'i would like %number% lakhs', 'intent.expected_ctc');
    this.nlpManager.addDocument('en', 'my expected salary is %number% lakhs', 'intent.expected_ctc');

    // Availability responses
    this.nlpManager.addDocument('en', 'i am available on %date%', 'intent.availability');
    this.nlpManager.addDocument('en', 'available %date%', 'intent.availability');
    this.nlpManager.addDocument('en', 'can do %date%', 'intent.availability');
    this.nlpManager.addDocument('en', '%date% works for me', 'intent.availability');
    this.nlpManager.addDocument('en', 'how about %date%', 'intent.availability');
    this.nlpManager.addDocument('en', 'next %date%', 'intent.availability');
    this.nlpManager.addDocument('en', '%date% is good', 'intent.availability');
    
    // Add more date entities
    this.nlpManager.addNamedEntityText('date', 'monday', ['en'], ['monday', 'next monday', 'coming monday']);
    this.nlpManager.addNamedEntityText('date', 'tuesday', ['en'], ['tuesday', 'next tuesday', 'coming tuesday']);
    this.nlpManager.addNamedEntityText('date', 'wednesday', ['en'], ['wednesday', 'next wednesday', 'coming wednesday']);
    this.nlpManager.addNamedEntityText('date', 'thursday', ['en'], ['thursday', 'next thursday', 'coming thursday']);
    this.nlpManager.addNamedEntityText('date', 'friday', ['en'], ['friday', 'next friday', 'coming friday']);

    // Train the model
    console.log('Training NLP model...');
    this.nlpManager.train();
    console.log('NLP model trained successfully');
  }

  convertWordToNumber(word) {
    const words = word.toLowerCase().split(' ');
    let result = 0;
    let current = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Handle lakh
      if (word === 'lakh' || word === 'lakhs') {
        current = (current || 1) * 100000;
        continue;
      }
      // Handle other number words
      if (this.numberWords[word] !== undefined) {
        if (this.numberWords[word] === 100 || this.numberWords[word] === 1000) {
          current *= this.numberWords[word];
        } else {
          current += this.numberWords[word];
        }
      }
    }

    result += current;
    return result;
  }

  extractNumber(text) {
    // First try to find a numeric number
    const numericMatch = text.match(/\d+/);
    if (numericMatch) {
      return parseInt(numericMatch[0]);
    }

    // If no numeric number found, try to convert word numbers
    const words = text.toLowerCase().split(' ');
    let numberPhrase = '';
    let foundNumber = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Check for number words or 'lakh'
      if (this.numberWords[word] !== undefined || word === 'lakh' || word === 'lakhs') {
        foundNumber = true;
        numberPhrase += word + ' ';
      } else if (foundNumber) {
        // If we found a number but now hit a non-number word, break
        break;
      }
    }

    if (numberPhrase) {
      const number = this.convertWordToNumber(numberPhrase.trim());
      // If the number is in lakhs, divide by 100000 to get the lakh value
      if (number >= 100000) {
        return number / 100000;
      }
      return number;
    }

    return null;
  }

  async speak(text) {
    return new Promise((resolve, reject) => {
      say.speak(text, null, 1.0, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async listen() {
    if (!this.isInitialized) {
      throw new Error('Voice agent not initialized. Please call init() first.');
    }

    if (!this.recognizer) {
      throw new Error('Speech recognizer not initialized. Please call init() first.');
    }

    return new Promise((resolve, reject) => {
      try {
        const outputFile = path.join(process.cwd(), 'temp_recording.wav');
        console.log('\nStarting recording...');
        console.log('Please speak when you see "Recording..." (5 seconds)');

        // Use Windows audio API directly with improved settings
        const soxProcess = spawn(process.env.SOX_PATH, [
          '-t', 'waveaudio',     // Use Windows audio API
          '-d',                  // Use default device
          '-t', 'wav',           // Output format
          '-r', '16000',         // Sample rate
          '-c', '1',             // Mono
          '-b', '16',            // Bit depth
          outputFile,            // Output file
          'trim', '0', '5',      // Record for 5 seconds
          'gain', '10'           // Increase gain for better recognition
        ]);

        console.log('Recording...');

        soxProcess.stderr.on('data', (data) => {
          const message = data.toString();
          if (!message.includes('In:') && !message.includes('Out:')) {
            console.log('Recording message:', message);
          }
        });

        soxProcess.on('error', (err) => {
          console.error('Recording error:', err);
          reject(err);
        });

        // Wait for recording to complete
        soxProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error('Recording failed with code:', code);
            reject(new Error('Recording failed. Please check your microphone settings in Windows Sound settings.'));
            return;
          }

          try {
            console.log('Processing audio...');
            
            // Read the file directly
            const audioData = fs.readFileSync(outputFile);
            
            // Process with Vosk
            if (this.recognizer.acceptWaveform(audioData)) {
              const result = this.recognizer.result();
              console.log('Speech detected:', result.text);
              resolve(result.text);
            } else {
              const finalResult = this.recognizer.finalResult();
              console.log('Final result:', finalResult.text);
              resolve(finalResult.text || '');
            }

            // Clean up
            try {
              fs.unlinkSync(outputFile);
            } catch (err) {
              console.warn('Could not delete temporary file:', err);
            }

          } catch (error) {
            console.error('Error processing audio:', error);
            reject(error);
          }
        });

      } catch (error) {
        console.error('Error in listen method:', error);
        reject(error);
      }
    });
  }

  async conductInterview() {
    try {
      console.log('Starting interview...');
      
      // Interest check
      await this.speak('Hello! Are you interested in the software developer position?');
      const interestResponse = await this.listen();
      console.log('Interest response:', interestResponse);
      const interestResult = await this.nlpManager.process('en', interestResponse);
      
      if (interestResult.intent === 'intent.not_interested') {
        await this.speak('Thank you for your time. Have a great day!');
        return {
          interested: false
        };
      }

      // Notice period
      await this.speak('What is your notice period in days?');
      const noticeResponse = await this.listen();
      console.log('Notice period response:', noticeResponse);
      const noticeResult = await this.nlpManager.process('en', noticeResponse);
      let noticePeriod;
      
      if (noticeResult.intent === 'intent.notice_period') {
        noticePeriod = this.extractNumber(noticeResponse);
        console.log('Extracted notice period:', noticePeriod);
      }

      // Current CTC
      await this.speak('What is your current CTC in lakhs per annum?');
      const currentCtcResponse = await this.listen();
      console.log('Current CTC response:', currentCtcResponse);
      const currentCtcResult = await this.nlpManager.process('en', currentCtcResponse);
      let currentCtc;
      
      if (currentCtcResult.intent === 'intent.current_ctc') {
        currentCtc = this.extractNumber(currentCtcResponse);
        console.log('Extracted current CTC:', currentCtc);
      }

      // Expected CTC
      await this.speak('What is your expected CTC in lakhs per annum?');
      const expectedCtcResponse = await this.listen();
      console.log('Expected CTC response:', expectedCtcResponse);
      const expectedCtcResult = await this.nlpManager.process('en', expectedCtcResponse);
      let expectedCtc;
      
      if (expectedCtcResult.intent === 'intent.expected_ctc') {
        expectedCtc = this.extractNumber(expectedCtcResponse);
        console.log('Extracted expected CTC:', expectedCtc);
      }

      // Availability
      await this.speak('When would you be available to start? Please mention a day of the week.');
      const availabilityResponse = await this.listen();
      console.log('Availability response:', availabilityResponse);
      const availabilityResult = await this.nlpManager.process('en', availabilityResponse);
      let availableDate;
      
      if (availabilityResult.intent === 'intent.availability') {
        const date = availabilityResult.entities.find(e => e.entity === 'date');
        availableDate = date ? date.option : undefined;
      }

      // Final response
      const response = {
        interested: true,
        noticePeriod,
        currentCtc,
        expectedCtc,
        availableDate
      };

      console.log('Interview completed. Results:', response);
      
      let summary = 'Thank you for your responses. Let me summarize: ';
      if (noticePeriod) {
        summary += `Your notice period is ${noticePeriod} days. `;
      }
      if (currentCtc) {
        summary += `Your current CTC is ${currentCtc} lakhs. `;
      }
      if (expectedCtc) {
        summary += `Your expected CTC is ${expectedCtc} lakhs. `;
      }
      if (availableDate) {
        summary += `You can start on ${availableDate}. `;
      }
      
      await this.speak(summary + 'We will get back to you soon. Have a great day!');
      
      return response;
    } catch (error) {
      console.error('Error during interview:', error);
      await this.speak('I apologize, but there was an error during the interview. Please try again later.');
      throw error;
    }
  }

  // Clean up resources
  cleanup() {
    if (this.recognizer) {
      this.recognizer.free();
      this.recognizer = null;
    }
    if (this.model) {
      this.model.free();
      this.model = null;
    }
    this.isInitialized = false;
  }
}

module.exports = VoiceAgent; 