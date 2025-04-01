const pool = require('../config/database');
const calendarService = require('../services/calendarService');

const getAllAppointments = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, j.title as job_title, c.name as candidate_name 
      FROM appointments a 
      JOIN jobs j ON a.job_id = j.id 
      JOIN candidates c ON a.candidate_id = c.id
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, j.title as job_title, c.name as candidate_name 
      FROM appointments a 
      JOIN jobs j ON a.job_id = j.id 
      JOIN candidates c ON a.candidate_id = c.id 
      WHERE a.id = $1
    `, [req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
};

const createAppointment = async (req, res) => {
  try {
    const { job_id, candidate_id, date_time, status } = req.body;

    const { rows: jobRows } = await pool.query('SELECT title FROM jobs WHERE id = $1', [job_id]);
    const { rows: candidateRows } = await pool.query('SELECT name FROM candidates WHERE id = $1', [candidate_id]);

    if (!jobRows.length || !candidateRows.length) {
      return res.status(404).json({ error: 'Job or candidate not found' });
    }

    let calendarEventId = null;
    try {
      const eventEndTime = new Date(date_time);
      eventEndTime.setHours(eventEndTime.getHours() + 1); // 1-hour interview

      const calendarEvent = await calendarService.createEvent(
        `Interview: ${jobRows[0].title}`,
        `Interview with ${candidateRows[0].name} for ${jobRows[0].title} position`,
        date_time,
        eventEndTime.toISOString()
      );

      calendarEventId = calendarEvent.id;
    } catch (calendarError) {
      console.error('Error creating calendar event:', calendarError);
    }

    const { rows } = await pool.query(
      'INSERT INTO appointments (job_id, candidate_id, date_time, status, calendar_event_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [job_id, candidate_id, date_time, status, calendarEventId]
    );

    res.status(201).json({
      ...rows[0],
      calendar_error: calendarEventId ? null : 'Failed to create calendar event'
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment', details: error.message });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const { job_id, candidate_id, date_time, status } = req.body;

    const { rows: appointmentRows } = await pool.query('SELECT calendar_event_id FROM appointments WHERE id = $1', [req.params.id]);
    
    if (!appointmentRows.length) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    let calendarError = null;
    if (date_time && appointmentRows[0].calendar_event_id) {
      try {
        const eventEndTime = new Date(date_time);
        eventEndTime.setHours(eventEndTime.getHours() + 1);

        await calendarService.updateEvent(appointmentRows[0].calendar_event_id, {
          start: {
            dateTime: date_time,
            timeZone: 'UTC',
          },
          end: {
            dateTime: eventEndTime.toISOString(),
            timeZone: 'UTC',
          },
        });
      } catch (calendarError) {
        console.error('Error updating calendar event:', calendarError);
        calendarError = 'Failed to update calendar event';
      }
    }

    const { rows } = await pool.query(
      'UPDATE appointments SET job_id = $1, candidate_id = $2, date_time = $3, status = $4 WHERE id = $5 RETURNING *',
      [job_id, candidate_id, date_time, status, req.params.id]
    );

    res.json({
      ...rows[0],
      calendar_error: calendarError
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment', details: error.message });
  }
};

const deleteAppointment = async (req, res) => {
  try {
    const { rows: appointmentRows } = await pool.query('SELECT calendar_event_id FROM appointments WHERE id = $1', [req.params.id]);
    
    if (!appointmentRows.length) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    let calendarError = null;
    if (appointmentRows[0].calendar_event_id) {
      try {
        await calendarService.deleteEvent(appointmentRows[0].calendar_event_id);
      } catch (calendarError) {
        console.error('Error deleting calendar event:', calendarError);
        calendarError = 'Failed to delete calendar event';
      }
    }
    
    await pool.query('DELETE FROM appointments WHERE id = $1', [req.params.id]);

    res.json({ 
      message: 'Appointment deleted successfully',
      calendar_error: calendarError
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment', details: error.message });
  }
};

module.exports = {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment
}; 