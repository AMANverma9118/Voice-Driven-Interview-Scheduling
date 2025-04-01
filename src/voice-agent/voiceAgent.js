const { NlpManager } = require('node-nlp');
const say = require('say');
const vosk = require('vosk');
const wav = require('wav');
const record = require('node-record-lpcm16');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const pool = require('../config/database');

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
  
      await this.setupNLP();
      
    
      const modelPath = path.resolve(process.cwd(), process.env.VOSK_MODEL_PATH);
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Vosk model not found at ${modelPath}. Please download the model and set VOSK_MODEL_PATH environment variable.`);
      }
      
      console.log('Initializing Vosk model from:', modelPath);
      vosk.setLogLevel(-1); // Disable logging
      
      this.model = new vosk.Model(modelPath);
      if (!this.model) {
        throw new Error('Failed to create Vosk model');
      }
      
      this.recognizer = new vosk.Recognizer({ model: this.model, sampleRate: 16000 });
      if (!this.recognizer) {
        throw new Error('Failed to create Vosk recognizer');
      }
      
      console.log('Vosk model initialized successfully');

      const soxPath = process.env.SOX_PATH || path.join(process.cwd(), 'sox-14.4.2', 'sox.exe');
      if (!fs.existsSync(soxPath)) {
        throw new Error(`Sox not found at ${soxPath}. Please set SOX_PATH environment variable to your sox.exe location.`);
      }
      process.env.PATH = `${path.dirname(soxPath)};${process.env.PATH}`;

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
            this.defaultAudioDevice = { id: '-d', name: 'Default Audio Device' };
          resolve();
          return;
        }

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
        this.defaultAudioDevice = { id: '-d', name: 'Default Audio Device' };
        resolve();
      });
    });
  }

  setupNLP() {
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

    this.nlpManager.addDocument('en', 'my notice period is %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', '%number% days notice', 'intent.notice_period');
    this.nlpManager.addDocument('en', '%number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'it is %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'around %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', '%number% days notice period', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'notice period of %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'my notice period is %number%', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'i have %number% days notice', 'intent.notice_period');

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

    this.nlpManager.addDocument('en', 'i am available on %date%', 'intent.availability');
    this.nlpManager.addDocument('en', 'available %date%', 'intent.availability');
    this.nlpManager.addDocument('en', 'can do %date%', 'intent.availability');
    this.nlpManager.addDocument('en', '%date% works for me', 'intent.availability');
    this.nlpManager.addDocument('en', 'how about %date%', 'intent.availability');
    this.nlpManager.addDocument('en', 'next %date%', 'intent.availability');
    this.nlpManager.addDocument('en', '%date% is good', 'intent.availability');
    
    this.nlpManager.addNamedEntityText('date', 'monday', ['en'], ['monday', 'next monday', 'coming monday']);
    this.nlpManager.addNamedEntityText('date', 'tuesday', ['en'], ['tuesday', 'next tuesday', 'coming tuesday']);
    this.nlpManager.addNamedEntityText('date', 'wednesday', ['en'], ['wednesday', 'next wednesday', 'coming wednesday']);
    this.nlpManager.addNamedEntityText('date', 'thursday', ['en'], ['thursday', 'next thursday', 'coming thursday']);
    this.nlpManager.addNamedEntityText('date', 'friday', ['en'], ['friday', 'next friday', 'coming friday']);

    this.nlpManager.addNamedEntityText('date', 'saturday', ['en'], ['saturday', 'next saturday', 'coming saturday']);
    this.nlpManager.addNamedEntityText('date', 'sunday', ['en'], ['sunday', 'next sunday', 'coming sunday']);

    this.nlpManager.addDocument('en', 'i am available on saturday', 'intent.availability');
    this.nlpManager.addDocument('en', 'i am available on sunday', 'intent.availability');
    this.nlpManager.addDocument('en', 'saturday works for me', 'intent.availability');
    this.nlpManager.addDocument('en', 'sunday works for me', 'intent.availability');
    this.nlpManager.addDocument('en', 'can do saturday', 'intent.availability');
    this.nlpManager.addDocument('en', 'can do sunday', 'intent.availability');

    this.nlpManager.addDocument('en', 'what is the role about', 'intent.role_details');
    this.nlpManager.addDocument('en', 'tell me about the job', 'intent.role_details');
    this.nlpManager.addDocument('en', 'what does this job involve', 'intent.role_details');
    this.nlpManager.addDocument('en', 'what are the responsibilities', 'intent.role_details');
    this.nlpManager.addDocument('en', 'what will i be doing', 'intent.role_details');

    this.nlpManager.addDocument('en', 'what is the salary range', 'intent.salary_info');
    this.nlpManager.addDocument('en', 'what is the pay', 'intent.salary_info');
    this.nlpManager.addDocument('en', 'what is the compensation', 'intent.salary_info');

    this.nlpManager.addDocument('en', 'what are the requirements', 'intent.requirements');
    this.nlpManager.addDocument('en', 'what skills are needed', 'intent.requirements');
    this.nlpManager.addDocument('en', 'what qualifications are needed', 'intent.requirements');

    this.nlpManager.addDocument('en', 'where is the office', 'intent.location');
    this.nlpManager.addDocument('en', 'is this remote', 'intent.location');
    this.nlpManager.addDocument('en', 'what is the work location', 'intent.location');

    this.nlpManager.addDocument('en', 'yes that is correct', 'intent.confirm');
    this.nlpManager.addDocument('en', 'yes that works', 'intent.confirm');
    this.nlpManager.addDocument('en', 'sure that is fine', 'intent.confirm');
    this.nlpManager.addDocument('en', 'no that is not correct', 'intent.reject');
    this.nlpManager.addDocument('en', 'no i need a different time', 'intent.reject');
    this.nlpManager.addDocument('en', 'can we change the time', 'intent.reject');

    this.nlpManager.addDocument('en', 'i am very interested', 'intent.interest');
    this.nlpManager.addDocument('en', 'i would love to', 'intent.interest');

    this.nlpManager.addDocument('en', 'my notice period is about %number% days', 'intent.notice_period');
    this.nlpManager.addDocument('en', 'i need %number% days notice', 'intent.notice_period');

    this.nlpManager.addDocument('en', 'my current package is %number% lakhs', 'intent.current_ctc');
    this.nlpManager.addDocument('en', 'i draw %number% lakhs', 'intent.current_ctc');

    this.nlpManager.addDocument('en', 'i am looking for %number% lakhs', 'intent.expected_ctc');
    this.nlpManager.addDocument('en', 'i expect a package of %number% lakhs', 'intent.expected_ctc');

    this.nlpManager.addDocument('en', 'i am free next %date%', 'intent.availability');
    this.nlpManager.addDocument('en', 'i can be available on %date%', 'intent.availability');

    console.log('NLP setup complete with additional variations for intents');

    console.log('Training NLP model...');
    this.nlpManager.train();
    console.log('NLP model trained successfully');

    
    this.nlpManager.addDocument('en', "i don't have any questions", 'intent.no_questions');
    this.nlpManager.addAnswer('en', 'intent.no_questions', 'Okay');

    console.log('NLP setup enhanced with additional variations for intents and improved post-processing');
  }

  convertWordToNumber(word) {
    const words = word.toLowerCase().split(' ');
    let result = 0;
    let current = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word === 'lakh' || word === 'lakhs') {
        current = (current || 1) * 100000;
        continue;
      }
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
    const numericMatch = text.match(/\d+/);
    if (numericMatch) {
      return parseInt(numericMatch[0]);
    }

    const words = text.toLowerCase().split(' ');
    let numberPhrase = '';
    let foundNumber = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (this.numberWords[word] !== undefined || word === 'lakh' || word === 'lakhs') {
        foundNumber = true;
        numberPhrase += word + ' ';
      } else if (foundNumber) {
        break;
      }
    }

    if (numberPhrase) {
      const number = this.convertWordToNumber(numberPhrase.trim());
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

        soxProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error('Recording failed with code:', code);
            reject(new Error('Recording failed. Please check your microphone settings in Windows Sound settings.'));
            return;
          }

          try {
            console.log('Processing audio...');
            
            const audioData = fs.readFileSync(outputFile);
            
            if (this.recognizer.acceptWaveform(audioData)) {
              const result = this.recognizer.result();
              console.log('Speech detected:', result.text);
              resolve(result.text);
            } else {
              const finalResult = this.recognizer.finalResult();
              console.log('Final result:', finalResult.text);
              resolve(finalResult.text || '');
            }

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

  getFAQResponse(intent) {
    const faqResponses = {
      'intent.role_details': 'This is a software developer position where you will be working on developing and maintaining web applications. You will be part of a team that builds scalable solutions using modern technologies.',
      'intent.salary_info': 'The salary range for this position is competitive and will be discussed based on your experience and skills. We offer a comprehensive benefits package including health insurance and paid time off.',
      'intent.requirements': 'We are looking for candidates with strong programming skills, preferably in JavaScript and Node.js. Experience with web development frameworks and databases is required. A bachelor\'s degree in computer science or related field is preferred.',
      'intent.location': 'This position is based in our main office. We offer flexible work arrangements and remote work options based on team needs.'
    };
    return faqResponses[intent] || 'I apologize, but I don\'t have specific information about that. Would you like to speak with a human recruiter for more details?';
  }

  async getCandidateAndJobDetails(candidateId, jobId) {
    try {
      const { rows: candidateRows } = await pool.query(
        'SELECT name FROM candidates WHERE id = $1',
        [candidateId]
      );
      
      if (!candidateRows.length) {
        throw new Error('Candidate not found');
      }

      const { rows: jobRows } = await pool.query(
        'SELECT title FROM jobs WHERE id = $1',
        [jobId]
      );
      
      if (!jobRows.length) {
        throw new Error('Job not found');
      }

      return {
        candidateName: candidateRows[0].name,
        jobTitle: jobRows[0].title,
        companyName: 'our company' // You can fetch this from a company table if you have one
      };
    } catch (error) {
      console.error('Error fetching candidate and job details:', error);
      throw error;
    }
  }

  async conductInterview(candidateId, jobId) {
    try {
      console.log('Starting interview...');
      
      const { candidateName, jobTitle, companyName } = await this.getCandidateAndJobDetails(candidateId, jobId);
      
      await this.speak(`Hello ${candidateName}, this is ${companyName} regarding a ${jobTitle} opportunity.`);
      
      await this.speak('Are you interested in this role?');
      const interestResponse = await this.listen();
      console.log('Interest response:', interestResponse);
      const interestResult = await this.nlpManager.process('en', interestResponse);
      
      if (interestResult.intent === 'intent.not_interested') {
        await this.speak('Thank you for your time. Have a great day!');
        return {
          interested: false,
          candidateId,
          jobId,
          candidateName,
          companyName,
          jobTitle
        };
      }

      await this.speak('What is your current notice period?');
      const noticeResponse = await this.listen();
      console.log('Notice period response:', noticeResponse);
      const noticeResult = await this.nlpManager.process('en', noticeResponse);
      let noticePeriod;
      
      if (noticeResult.intent === 'intent.notice_period') {
        noticePeriod = this.extractNumber(noticeResponse);
        console.log('Extracted notice period:', noticePeriod);
      }

      await this.speak('Can you share your current and expected CTC?');
      const ctcResponse = await this.listen();
      console.log('CTC response:', ctcResponse);
      
      const currentCtcResult = await this.nlpManager.process('en', ctcResponse);
      let currentCtc;
      if (currentCtcResult.intent === 'intent.current_ctc') {
        currentCtc = this.extractNumber(ctcResponse);
        console.log('Extracted current CTC:', currentCtc);
      }

      await this.speak('And what is your expected CTC?');
      const expectedCtcResponse = await this.listen();
      console.log('Expected CTC response:', expectedCtcResponse);
      const expectedCtcResult = await this.nlpManager.process('en', expectedCtcResponse);
      let expectedCtc;
      
      if (expectedCtcResult.intent === 'intent.expected_ctc') {
        expectedCtc = this.extractNumber(expectedCtcResponse);
        console.log('Extracted expected CTC:', expectedCtc);
      }

      await this.speak('When are you available for an interview next week?');
      const availabilityResponse = await this.listen();
      console.log('Availability response:', availabilityResponse);
      const availabilityResult = await this.nlpManager.process('en', availabilityResponse);
      let availableDate;
      
      if (availabilityResult.intent === 'intent.availability') {
        const date = availabilityResult.entities.find(e => e.entity === 'date');
        availableDate = date ? date.option : undefined;
      }

      if (availableDate) {
        availableDate = this.getNextDate(availableDate);
      }

      const interviewDate = availableDate ? `next ${availableDate}` : 'a suitable date';
      await this.speak(`We've scheduled your interview on ${interviewDate}. Is that correct?`);
      const confirmationResponse = await this.listen();
      console.log('Confirmation response:', confirmationResponse);
      const confirmationResult = await this.nlpManager.process('en', confirmationResponse);

      if (confirmationResult.intent === 'intent.reject') {
        await this.speak('I understand you need a different time. Please let us know your preferred time and we will reschedule.');
        return {
          interested: true,
          noticePeriod,
          currentCtc,
          expectedCtc,
          availableDate,
          confirmed: false,
          candidateId,
          jobId,
          candidateName,
          companyName,
          jobTitle
        };
      }

      await this.speak('Do you have any questions about the role?');
      const questionResponse = await this.listen();
      console.log('Question response:', questionResponse);
      const questionResult = await this.nlpManager.process('en', questionResponse);

      if (questionResult.intent === 'intent.no_questions') {
        await this.speak('Okay');
      } else if (questionResult.intent.startsWith('intent.')) {
        const faqResponse = this.getFAQResponse(questionResult.intent);
        await this.speak(faqResponse);
      }

      console.log('Recognized intent for question response:', questionResult.intent);

      const response = {
        interested: true,
        noticePeriod,
        currentCtc,
        expectedCtc,
        availableDate,
        confirmed: true,
        candidateId,
        jobId,
        candidateName,
        companyName,
        jobTitle
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
        summary += `Your interview is scheduled for next ${availableDate}. `;
      }
      
      await this.speak(summary + 'We will get back to you soon. Have a great day!');
      
      console.log('Preparing to save interview results to the database...');
      console.log('Candidate ID:', candidateId);
      console.log('Job ID:', jobId);
      console.log('Interested:', response.interested);
      console.log('Notice Period:', response.noticePeriod);
      console.log('Current CTC:', response.currentCtc);
      console.log('Expected CTC:', response.expectedCtc);
      console.log('Available Date:', response.availableDate);
      console.log('Confirmed:', response.confirmed);

      const query = 'INSERT INTO interview_results (candidate_id, job_id, interested, notice_period, current_ctc, expected_ctc, available_date, confirmed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
      const values = [candidateId, jobId, response.interested, response.noticePeriod, response.currentCtc, response.expectedCtc, response.availableDate, response.confirmed];

      pool.query(query, values, (error, result) => {
        if (error) {
          console.error('Error saving interview results:', error);
        } else {
          console.log('Interview results saved successfully');
        }
      });

      return response;
    } catch (error) {
      console.error('Error during interview:', error);
      await this.speak('I apologize, but there was an error during the interview. Please try again later.');
      throw error;
    }
  }

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
      
  getNextDate(day) {
    const today = moment();
    const targetDay = moment().day(day);
    if (targetDay.isBefore(today, 'day')) {
      targetDay.add(1, 'weeks');
    }
    return targetDay.format('YYYY-MM-DD');
  }
}

module.exports = VoiceAgent; 