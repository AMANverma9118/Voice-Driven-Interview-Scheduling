const crypto = require('crypto');
const { WebSocket } = require('ws');

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VOICE = 'en-IN-NeerjaNeural';
const CHROMIUM = '143.0.3650.75';
let skewSeconds = 0;

function gecToken() {
  let ticks = Date.now() / 1000 + skewSeconds + 11644473600;
  ticks -= ticks % 300;
  ticks = Math.round(ticks * 1e7);
  return crypto.createHash('sha256').update(`${ticks}${TOKEN}`).digest('hex').toUpperCase();
}

function edgeTimestamp() {
  const date = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (value) => String(value).padStart(2, '0');
  return `${days[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${pad(date.getUTCDate())} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function speakNeural(text) {
  const spoken = escapeXml(String(text || '').slice(0, 500));
  const connection = crypto.randomUUID().replace(/-/g, '');
  const requestId = crypto.randomUUID().replace(/-/g, '');
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${gecToken()}&Sec-MS-GEC-Version=1-${CHROMIUM}&ConnectionId=${connection}`;

  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    const finish = (error, audio) => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch (err) { /* already closed */ }
      if (error) reject(error);
      else resolve(audio);
    };

    const socket = new WebSocket(url, {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0`,
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: `muid=${crypto.randomBytes(16).toString('hex').toUpperCase()};`,
      },
    });

    const timer = setTimeout(() => finish(new Error('The voice took too long')), 15000);

    socket.on('open', () => {
      const stamp = edgeTimestamp();
      socket.send(
        `X-Timestamp:${stamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`
        + '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}'
      );
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-IN'><voice name='${VOICE}'><prosody rate='-6%' pitch='+0Hz'>${spoken}</prosody></voice></speak>`;
      socket.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${edgeTimestamp()}\r\nPath:ssml\r\n\r\n${ssml}`
      );
    });

    socket.on('message', (data, isBinary) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (!isBinary) {
        if (buffer.toString('utf8').includes('Path:turn.end')) {
          clearTimeout(timer);
          finish(null, Buffer.concat(chunks));
        }
        return;
      }
      if (buffer.length < 2) return;
      const headerLength = buffer.readUInt16BE(0);
      const header = buffer.slice(2, 2 + headerLength).toString('utf8');
      if (header.includes('Path:audio')) chunks.push(buffer.slice(2 + headerLength));
    });

    socket.on('unexpected-response', (_request, response) => {
      const serverDate = response.headers.date;
      if (response.statusCode === 403 && serverDate && skewSeconds === 0) {
        const parsed = Date.parse(serverDate);
        if (!Number.isNaN(parsed)) skewSeconds = parsed / 1000 - Date.now() / 1000;
      }
    });

    socket.on('error', (error) => {
      clearTimeout(timer);
      finish(error);
    });

    socket.on('close', () => {
      clearTimeout(timer);
      if (!settled) finish(chunks.length ? null : new Error('The voice connection closed'), Buffer.concat(chunks));
    });
  });
}

module.exports = { speakNeural, VOICE };
