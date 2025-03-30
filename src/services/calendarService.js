const { google } = require('googleapis');
require('dotenv').config();

class CalendarService {
  constructor() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    this.auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async createEvent(summary, description, startTime, endTime) {
    try {
      const event = {
        summary,
        description,
        start: {
          dateTime: startTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime,
          timeZone: 'UTC',
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: event,
      });

      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  async getAvailableSlots(date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const response = await this.calendar.events.list({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items;
    } catch (error) {
      console.error('Error getting available slots:', error);
      throw error;
    }
  }

  async deleteEvent(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId,
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw error;
    }
  }

  async updateEvent(eventId, updates) {
    try {
      const event = await this.calendar.events.get({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId,
      });

      const updatedEvent = {
        ...event.data,
        ...updates,
      };

      const response = await this.calendar.events.update({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId,
        resource: updatedEvent,
      });

      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw error;
    }
  }
}

module.exports = new CalendarService(); 