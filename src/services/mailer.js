const crypto = require('crypto');
const nodemailer = require('nodemailer');

function appUrl() {
  const port = process.env.PORT || 3000;
  return (process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, '');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function makeToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

async function sendVerification(email, token) {
  const url = `${appUrl()}/verify?token=${token}`;
  if (!process.env.SMTP_HOST) {
    console.log(`Email is not configured. Verification link for ${email}: ${url}`);
    return { sent: false, url };
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Verify your Interview Desk account',
    text: `Open this link to verify your account:\n\n${url}\n\nIt expires in 24 hours.`,
  });

  return { sent: true };
}

async function sendTimeNotice(email, whenLabel) {
  const url = `${appUrl()}/messages`;
  const text = `The desk moved your interview to ${whenLabel}.\n\nOpen Messages to see it:\n${url}`;
  if (!process.env.SMTP_HOST) return { sent: false };

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Your interview time changed',
    text,
  });

  return { sent: true };
}

module.exports = { hashToken, makeToken, sendVerification, sendTimeNotice };
