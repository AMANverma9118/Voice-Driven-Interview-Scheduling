const path = require('path');
const fs = require('fs');

let model = null;
let loadError = null;

function getModel() {
  if (model) return model;
  if (loadError) throw loadError;
  const vosk = require('vosk');
  const modelPath = path.resolve(process.cwd(), process.env.VOSK_MODEL_PATH || 'models/vosk-model-small-en-us-0.15');
  if (!fs.existsSync(modelPath)) {
    loadError = new Error('Speech model is not installed');
    throw loadError;
  }
  vosk.setLogLevel(-1);
  model = new vosk.Model(modelPath);
  return model;
}

function timeGrammar() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const hours = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const phrases = ['yes', 'no', 'yeah', 'yep', 'correct', 'okay', '[unk]'];
  days.forEach((day) => {
    phrases.push(day, `on ${day}`, `next ${day}`);
    hours.forEach((word) => {
      phrases.push(
        `${day} at ${word}`,
        `${day} at ${word} pm`,
        `${day} at ${word} am`,
        `${day} at ${word} thirty`,
        `${day} at ${word} fifteen`,
        `${day} ${word} pm`,
        `${day} ${word} am`,
        `on ${day} at ${word}`,
        `on ${day} at ${word} pm`,
        `on ${day} at ${word} am`,
        `next ${day} at ${word} pm`,
        `next ${day} at ${word} am`
      );
    });
  });
  hours.forEach((word) => {
    phrases.push(
      word,
      `${word} pm`,
      `${word} am`,
      `${word} thirty`,
      `${word} fifteen`,
      `${word} forty five`,
      `half past ${word}`,
      `${word} o clock`
    );
  });
  return [...new Set(phrases)];
}

const recognizers = new Map();
let hearChain = Promise.resolve();

function recognizerFor(kind) {
  const key = kind === 'time' ? 'time' : 'free';
  if (recognizers.has(key)) return recognizers.get(key);
  const vosk = require('vosk');
  const options = { model: getModel(), sampleRate: 16000 };
  if (key === 'time') options.grammar = timeGrammar();
  const recognizer = new vosk.Recognizer(options);
  recognizers.set(key, recognizer);
  return recognizer;
}

function transcribePcm(pcm, kind) {
  const run = hearChain.then(() => {
    let recognizer;
    try {
      recognizer = recognizerFor(kind);
    } catch (error) {
      if (kind !== 'time') throw error;
      recognizer = recognizerFor('');
    }
    try {
      const size = 8000;
      for (let index = 0; index < pcm.length; index += size) {
        recognizer.acceptWaveform(pcm.subarray(index, index + size));
      }
      const result = recognizer.finalResult();
      const text = (result && result.text ? result.text : '').replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ').trim();
      return text;
    } finally {
      recognizer.reset();
    }
  });
  hearChain = run.then(() => {}, () => {});
  return run;
}

module.exports = { transcribePcm };
