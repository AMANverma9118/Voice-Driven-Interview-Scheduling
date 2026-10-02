const { google } = require('googleapis');
require('dotenv').config();

let calendar = null;
let configured = null;

function getCalendar() {
  if (configured === false) return null;
  if (calendar) return calendar;

  const raw = process.env.GOOGLE_CREDENTIALS;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!raw || !calendarId) {
    configured = false;
    return null;
  }

  try {
    const credentials = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    calendar = google.calendar({ version: 'v3', auth });
    configured = true;
    return calendar;
  } catch (error) {
    configured = false;
    console.error('Google Calendar credentials could not be read:', error.message);
    return null;
  }
}

function calendarId() {
  return process.env.GOOGLE_CALENDAR_ID;
}

async function createEvent(summary, description, startTime, endTime) {
  const client = getCalendar();
  if (!client) {
    throw new Error('Google Calendar is not configured');
  }

  const response = await client.events.insert({
    calendarId: calendarId(),
    resource: {
      summary,
      description,
      start: { dateTime: startTime, timeZone: 'UTC' },
      end: { dateTime: endTime, timeZone: 'UTC' },
    },
  });

  return response.data;
}

async function getAvailableSlots(date) {
  const client = getCalendar();
  if (!client) {
    throw new Error('Google Calendar is not configured');
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const response = await client.events.list({
    calendarId: calendarId(),
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items;
}

async function deleteEvent(eventId) {
  const client = getCalendar();
  if (!client) {
    throw new Error('Google Calendar is not configured');
  }

  await client.events.delete({
    calendarId: calendarId(),
    eventId,
  });
}

async function updateEvent(eventId, updates) {
  const client = getCalendar();
  if (!client) {
    throw new Error('Google Calendar is not configured');
  }

  const event = await client.events.get({
    calendarId: calendarId(),
    eventId,
  });

  const response = await client.events.update({
    calendarId: calendarId(),
    eventId,
    resource: { ...event.data, ...updates },
  });

  return response.data;
}

module.exports = {
  createEvent,
  getAvailableSlots,
  deleteEvent,
  updateEvent,
};
