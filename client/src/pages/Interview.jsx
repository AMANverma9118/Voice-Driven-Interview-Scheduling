import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { heardClock, heardDay, nextWeekday } from "../when.mjs";
import { api, apiUrl } from "../api";
import { useAuth } from "../auth";
import { useSettings } from "../settings";
import CandidateFrame from "../components/CandidateFrame";

const FEMALE_VOICE = /neerja|heera|zira|sonia|hazel|susan|jenny|aria|natasha|libby|samantha|victoria|fiona|moira|karen|tessa|veena|female/i;
const MALE_VOICE = /ravi|hemant|david|mark|guy|george|daniel|rishi|alex|fred|male/i;

function voicesReady() {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve([]);
  const existing = synth.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", done);
    window.setTimeout(done, 1000);
  });
}

function pickFemaleVoice(voices) {
  const english = voices.filter((voice) => /^en/i.test(voice.lang));
  const pool = english.length ? english : voices;
  const female = pool.filter((voice) => FEMALE_VOICE.test(voice.name) && !MALE_VOICE.test(voice.name));
  return female.find((voice) => /en-IN/i.test(voice.lang))
    || female.find((voice) => /en-GB/i.test(voice.lang))
    || female[0]
    || null;
}

function speakWithBrowser(text) {
  return voicesReady().then((voices) => new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      resolve();
      return;
    }
    synth.cancel();
    window.setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickFemaleVoice(voices.length ? voices : synth.getVoices());
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = "en-IN";
        utter.pitch = 1.25;
      }
      utter.rate = 0.94;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      synth.speak(utter);
    }, 80);
  }));
}

let sharedCtx = null;

function sharedAudio() {
  if (!sharedCtx) sharedCtx = new AudioContext();
  return sharedCtx;
}

async function speak(text) {
  window.speechSynthesis?.cancel();
  try {
    const token = localStorage.getItem("desk_token");
    const response = await fetch(apiUrl("/api/me/speak"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error("voice");
    const bytes = await response.arrayBuffer();
    const ctx = sharedAudio();
    await ctx.resume();
    const decoded = await ctx.decodeAudioData(bytes.slice(0));
    await new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      source.onended = () => resolve();
      source.start();
    });
  } catch (err) {
    await speakWithBrowser(text);
  }
}

function downsample(chunks, fromRate) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (!length) return { samples: new Int16Array(0), peak: 0 };
  const merged = new Float32Array(length);
  let offset = 0;
  let peak = 0;
  chunks.forEach((chunk) => {
    for (let i = 0; i < chunk.length; i += 1) peak = Math.max(peak, Math.abs(chunk[i]));
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  const gain = peak > 0.004 && peak < 0.25 ? Math.min(10, 0.55 / peak) : 1;
  const ratio = fromRate / 16000;
  const outLength = Math.max(1, Math.floor(merged.length / ratio));
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(merged.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += merged[j];
    const sample = Math.max(-1, Math.min(1, (sum / Math.max(1, end - start)) * gain));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return { samples: out, peak };
}

function createMicSession() {
  let stream = null;
  let ctx = null;
  let processor = null;
  let deviceId = null;
  let collecting = null;
  let onLevel = () => {};

  function close() {
    collecting = null;
    try { processor?.disconnect(); } catch (err) { /* already stopped */ }
    stream?.getTracks().forEach((track) => track.stop());
    ctx?.close().catch(() => {});
    stream = null;
    ctx = null;
    processor = null;
    deviceId = null;
  }

  async function open(nextId) {
    const wanted = nextId || "";
    if (stream && deviceId === wanted) return;
    close();
    const audio = {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
    };
    if (wanted) audio.deviceId = { exact: wanted };
    stream = await navigator.mediaDevices.getUserMedia({ audio });
    deviceId = wanted;
    ctx = new AudioContext();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    processor = ctx.createScriptProcessor(4096, 1, 1);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      let energy = 0;
      for (let i = 0; i < input.length; i += 1) energy += input[i] * input[i];
      energy = Math.sqrt(energy / input.length);
      onLevel(Math.min(1, energy * 8));
      if (collecting) collecting(input, ctx.sampleRate, energy);
    };
    source.connect(processor);
    processor.connect(gain);
    gain.connect(ctx.destination);
    await new Promise((wait) => window.setTimeout(wait, 400));
  }

  function listen(levelSetter) {
    onLevel = levelSetter || (() => {});
    return new Promise((resolve) => {
      const chunks = [];
      let heardSpeech = false;
      let quiet = 0;
      let stopped = false;
      const started = performance.now();
      const stop = () => {
        if (stopped) return;
        stopped = true;
        collecting = null;
        window.clearTimeout(wall);
        resolve(downsample(chunks, ctx.sampleRate));
      };
      const wall = window.setTimeout(stop, 12000);
      collecting = (input, sampleRate, energy) => {
        if (performance.now() - started < 200) return;
        chunks.push(new Float32Array(input));
        if (energy > 0.008) {
          heardSpeech = true;
          quiet = 0;
        } else if (heardSpeech) {
          quiet += input.length / sampleRate;
          if (quiet > 0.9) stop();
        }
      };
    });
  }

  return { open, listen, close };
}

function pcmToBase64(samples) {
  const bytes = new Uint8Array(samples.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function heardNumber(text) {
  const match = String(text).match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function yes(text) {
  return /\b(yes|yeah|yep|sure|interested|ok|okay|correct|works)\b/i.test(text);
}

function no(text) {
  return /\b(no|nope|not|pass)\b/i.test(text);
}

function whenLabel(date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function Interview() {
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState("ready");
  const [prompt, setPrompt] = useState("Pick a role, then start the call. The desk will speak, then listen.");
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [mics, setMics] = useState([]);
  const [micId, setMicId] = useState("");
  const [level, setLevel] = useState(0);
  const pending = useRef(null);
  const micRef = useRef(micId);
  const ears = useRef(null);
  const clipRef = useRef(null);
  const turnsRef = useRef([]);
  const hearKind = useRef("");
  const [savedTurns, setSavedTurns] = useState([]);
  if (!ears.current) ears.current = createMicSession();
  const company = settings?.companyName || "Interview Desk";

  useEffect(() => {
    micRef.current = micId;
  }, [micId]);

  useEffect(() => () => ears.current?.close(), []);

  useEffect(() => {
    let cancel = false;
    if (!navigator.mediaDevices?.getUserMedia) return undefined;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(async (stream) => {
      stream.getTracks().forEach((track) => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (cancel) return;
      const inputs = devices.filter((device) => device.kind === "audioinput");
      setMics(inputs);
      const computer = inputs.find((device) => /array|realtek|internal|built-in|laptop|default/i.test(device.label) && !/headset|earphone|airpod|bluetooth|hands-free/i.test(device.label));
      if (computer) setMicId(computer.deviceId);
    }).catch(() => {});
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    api("/api/jobs")
      .then((rows) => {
        setJobs(rows);
        setJobId(rows[0]?.id || "");
      })
      .catch((err) => setError(err.message));
    api("/api/me/profile")
      .then((record) => {
        if (record?.phone) setPhone(record.phone);
      })
      .catch(() => {});
  }, []);

  async function capture() {
    await ears.current.open(micRef.current);
    return ears.current.listen(setLevel);
  }

  function listen() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        pending.current = null;
        resolve((value || "").trim());
      };
      pending.current = finish;
      setPhase("listening");
      setError("");
      setHeard("");

      capture().then(async ({ samples, peak }) => {
        if (settled) return;
        if (peak < 0.012) {
          setError("That microphone is silent. Keep the OnePlus buds for sound, and pick the computer microphone before you start. Or type the answer.");
          setPhase("typing");
          return;
        }
        setPhase("hearing");
        try {
          const data = await api("/api/me/hear", {
            method: "POST",
            body: JSON.stringify({ audio: pcmToBase64(samples), kind: hearKind.current }),
          });
          const text = (data.text || "").trim();
          clipRef.current = peak >= 0.012 ? samples : null;
          if (text) {
            setHeard(text);
            finish(text);
          } else {
            setError("I heard the microphone, but not the words. Speak a little closer, then press Listen again, or type the answer.");
            setPhase("typing");
          }
        } catch (err) {
          setError(err.message);
          setPhase("typing");
        }
      }).catch((err) => {
        if (settled) return;
        setError(err.message || "Allow the microphone so the desk can hear you.");
        setPhase("typing");
      });
    });
  }

  function submitTyped(event) {
    event.preventDefault();
    const value = typed.trim();
    if (!value || !pending.current) return;
    setHeard(value);
    pending.current(value);
    setTyped("");
  }

  async function listenAgain() {
    if (!pending.current) return;
    setError("");
    setHeard("");
    setPhase("listening");
    try {
      const { samples, peak } = await capture();
      if (peak < 0.012) {
        setError("The earphones are not sending a voice. Many headsets have no microphone. Choose the computer microphone, then press Listen again.");
        setPhase("typing");
        return;
      }
      setPhase("hearing");
      const data = await api("/api/me/hear", {
        method: "POST",
        body: JSON.stringify({ audio: pcmToBase64(samples), kind: hearKind.current }),
      });
      const text = (data.text || "").trim();
      clipRef.current = peak >= 0.012 ? samples : clipRef.current;
      if (text && pending.current) {
        setHeard(text);
        pending.current(text);
      } else {
        setError("I heard the microphone, but not the words. Speak a little closer, then press Listen again.");
        setPhase("typing");
      }
    } catch (err) {
      setError(err.message);
      setPhase("typing");
    }
  }

  async function ask(line, kind = "") {
    setPrompt(line);
    setHeard("");
    setPhase("speaking");
    clipRef.current = null;
    hearKind.current = kind;
    await speak(line);
    const answer = await listen();
    setHeard(answer);
    turnsRef.current.push({
      prompt: line,
      answer,
      audio: clipRef.current && clipRef.current.length ? pcmToBase64(clipRef.current) : "",
    });
    return answer;
  }

  function keepRecord() {
    setSavedTurns(turnsRef.current.map((turn) => ({ prompt: turn.prompt, answer: turn.answer })));
  }

  async function file(job, answers) {
    const saved = await api("/api/interviews", {
      method: "POST",
      body: JSON.stringify({
        job_id: job.id,
        phone: phone.trim(),
        interested: answers.interested,
        confirmed: Boolean(answers.confirmed && answers.when),
        notice_period: answers.notice,
        current_ctc: answers.current,
        expected_ctc: answers.expected,
        available_date: answers.when ? answers.when.toISOString() : null,
        source: "voice",
        turns: turnsRef.current,
      }),
    });
    keepRecord();
    return saved;
  }

  async function begin(event) {
    event.preventDefault();
    const job = jobs.find((item) => item.id === jobId);
    if (!job || !phone.trim()) {
      setError("Choose a role and add a phone number.");
      return;
    }
    setError("");
    setResult("");
    await sharedAudio().resume();
    await ears.current.open(micRef.current);
    turnsRef.current = [];
    const answers = { interested: false, notice: null, current: null, expected: null, when: null, confirmed: false };

    try {
      await speak(`Hello ${user.name}. This is ${company}, calling about the ${job.title} role.`);
      const interest = await ask("Are you interested in this role? Say yes or no.");
      answers.interested = yes(interest) && !no(interest);
      if (!answers.interested) {
        await file(job, answers);
        await speak("Thank you for your time. Have a good day.");
        setPrompt("Not interested. The desk has that on file.");
        setPhase("done");
        return;
      }

      answers.notice = heardNumber(await ask("What is your notice period, in days?"));
      answers.current = heardNumber(await ask("What is your current CTC, in lakhs per year?"));
      answers.expected = heardNumber(await ask("And what CTC are you expecting, in lakhs?"));

      const availability = await ask("Which day and time next week? Say it like Monday at 3 pm.", "time");
      let day = heardDay(availability);
      let clock = heardClock(availability);
      if (!day) {
        day = heardDay(await ask("I missed the day. Say Monday, Tuesday, Wednesday, Thursday, or Friday.", "time"));
      }
      if (day && !clock) {
        clock = heardClock(await ask(`What time on ${day}? Say the hour, like 3 pm.`, "time"));
      }
      const slot = day ? nextWeekday(day, clock ? clock.hour : 10, clock ? clock.minute : 0) : null;
      if (!slot) {
        answers.when = null;
        answers.confirmed = false;
      } else {
        const confirm = await ask(`I have you down for ${whenLabel(slot)}. Is that correct?`);
        answers.confirmed = yes(confirm) && !no(confirm);
        if (!answers.confirmed) {
          const retry = await ask("Tell me the day and the hour again. For example, Tuesday at 11 am.", "time");
          const retryDay = heardDay(retry);
          const retryClock = heardClock(retry);
          if (retryDay) {
            answers.when = nextWeekday(retryDay, retryClock ? retryClock.hour : 10, retryClock ? retryClock.minute : 0);
            const confirmRetry = await ask(`I have you down for ${whenLabel(answers.when)}. Is that correct?`);
            answers.confirmed = yes(confirmRetry) && !no(confirmRetry);
            if (!answers.confirmed) answers.when = null;
          }
        } else {
          answers.when = slot;
        }
      }

      const saved = await file(job, answers);
      if (saved?.confirmed) {
        await speak(`You are booked for ${whenLabel(answers.when)}. We will see you then.`);
        setPrompt(`Booked for ${whenLabel(answers.when)}.`);
        setResult(whenLabel(answers.when));
      } else {
        await speak("I have your details. Someone from the team will confirm a time.");
        setPrompt("Details saved. A time is not booked yet.");
      }
      setPhase("done");
    } catch (err) {
      setError(err.message);
      await speak(err.message);
      setPhase("done");
    }
  }

  return (
    <CandidateFrame onSignOut={() => { ears.current?.close(); window.speechSynthesis?.cancel(); signOut(); }}>
        <p className="kicker">Candidate call</p>
        <h1>The desk will ask</h1>
        <p className="lede">It speaks the questions and listens for the answers, then books a time if you agree.</p>
        {error && <div className="banner" role="alert">{error}</div>}
        {phase === "ready" && (
          <form className="sheet" onSubmit={begin}>
            <div className="fields">
              <label>
                Role
                <select value={jobId} onChange={(event) => setJobId(event.target.value)} required>
                  {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                </select>
              </label>
              <label>
                Phone
                <input value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="+91 98..." />
              </label>
              <label className="span-2">
                Microphone
                <select value={micId} onChange={(event) => setMicId(event.target.value)}>
                  <option value="">Computer default</option>
                  {mics.map((mic) => <option key={mic.deviceId} value={mic.deviceId}>{mic.label || "Microphone"}</option>)}
                </select>
              </label>
            </div>
            {!jobs.length && <p>No open roles yet. An admin has to add one first.</p>}
            <div className="actions">
              <button className="btn" type="submit" disabled={!jobs.length}>Start the call</button>
            </div>
            <p className="note">Earphones are fine for hearing her. If they have no microphone, choose the computer microphone above. Speak after each question, then pause.</p>
          </form>
        )}
        {phase !== "ready" && (
          <section className="stage">
            <p className="stage-kicker">{phase === "listening" ? "Listening — speak now" : phase === "hearing" ? "Catching that" : phase === "typing" ? "Type the answer" : phase === "done" ? "Filed" : "Speaking"}</p>
            <p className="stage-line">{prompt}</p>
            {phase === "listening" && <div className="meter" aria-hidden="true"><span style={{ width: `${Math.round(level * 100)}%` }} /></div>}
            <p className="note">Using {mics.find((mic) => mic.deviceId === micId)?.label || "the selected microphone"} for every question.</p>
            {heard && <p className="stage-heard">Heard: {heard}</p>}
            {result && <p className="stage-booked">{result}</p>}
            {phase === "done" && savedTurns.length > 0 && (
              <div className="sheet">
                <h2>What you said</h2>
                {savedTurns.map((turn, index) => (
                  <article className="note-line" key={index}>
                    <p className="note-meta">Desk</p>
                    <p>{turn.prompt}</p>
                    <p className="note-meta">You</p>
                    <p>{turn.answer || "—"}</p>
                  </article>
                ))}
                <p className="note">The recording is kept under Record. You can play it whenever you come back.</p>
                <NavLink className="btn" to="/record">Open the record</NavLink>
              </div>
            )}
            {(phase === "listening" || phase === "typing") && (
              <form className="actions" onSubmit={submitTyped}>
                <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={phase === "listening" ? "Or type the answer" : "Type the answer"} />
                <button className="btn" type="submit">Send</button>
                {phase === "typing" && <button className="btn ghost" type="button" onClick={listenAgain}>Listen again</button>}
              </form>
            )}
          </section>
        )}
    </CandidateFrame>
  );
}
