const { google } = require('googleapis');
const logger = require('../config/logger');

class GoogleCalendarService {
  constructor({ env, auditService }) {
    this.enabled = env.GOOGLE_CALENDAR_ENABLED === 'true';
    this.calendarId = env.GOOGLE_CALENDAR_ID;
    this.timeZone = env.GOOGLE_CALENDAR_TIMEZONE || 'Europe/Copenhagen';
    this.auditService = auditService;

    if (!this.enabled) {
      this.calendar = null;
      return;
    }

    const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async createEvent({ appointment, service, userId = null, ipAddress = null }) {
    if (!this.enabled) {
      return { skipped: true, reason: 'disabled' };
    }

    if (appointment.google_event_id) {
      return { skipped: true, reason: 'already_synced', eventId: appointment.google_event_id };
    }

    const event = this.buildEvent({ appointment, service });

    try {
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
      });

      const eventId = response.data.id;
      logger.info('Google Calendar event created', {
        appointmentId: appointment.id,
        googleEventId: eventId,
      });

      await this.auditService.logAction({
        userId,
        action: 'GOOGLE_EVENT_CREATE_SUCCESS',
        entityType: 'appointment',
        entityId: appointment.id,
        newValue: { google_event_id: eventId },
        ipAddress,
      });

      return { eventId };
    } catch (error) {
      logger.error('Google Calendar event creation failed', {
        error,
        appointmentId: appointment.id,
      });

      await this.auditService.logAction({
        userId,
        action: 'GOOGLE_EVENT_CREATE_FAILED',
        entityType: 'appointment',
        entityId: appointment.id,
        newValue: {
          message: error.message,
          code: error.code,
        },
        ipAddress,
      });

      throw error;
    }
  }

  async cancelEvent({ appointment, userId = null, ipAddress = null }) {
    if (!this.enabled) {
      return { skipped: true, reason: 'disabled' };
    }

    if (!appointment.google_event_id) {
      return { skipped: true, reason: 'missing_event_id' };
    }

    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: appointment.google_event_id,
      });

      logger.info('Google Calendar event deleted', {
        appointmentId: appointment.id,
        googleEventId: appointment.google_event_id,
      });

      await this.auditService.logAction({
        userId,
        action: 'GOOGLE_EVENT_DELETE_SUCCESS',
        entityType: 'appointment',
        entityId: appointment.id,
        oldValue: { google_event_id: appointment.google_event_id },
        ipAddress,
      });

      return { deleted: true };
    } catch (error) {
      if (error.code === 404) {
        logger.warn('Google Calendar event already missing', {
          appointmentId: appointment.id,
          googleEventId: appointment.google_event_id,
        });
        return { deleted: false, missing: true };
      }

      logger.error('Google Calendar event deletion failed', {
        error,
        appointmentId: appointment.id,
        googleEventId: appointment.google_event_id,
      });

      await this.auditService.logAction({
        userId,
        action: 'GOOGLE_EVENT_DELETE_FAILED',
        entityType: 'appointment',
        entityId: appointment.id,
        oldValue: { google_event_id: appointment.google_event_id },
        newValue: {
          message: error.message,
          code: error.code,
        },
        ipAddress,
      });

      throw error;
    }
  }

  buildEvent({ appointment, service }) {
    const start = this.buildDateTime(appointment.appointment_date, appointment.time_slot);
    const duration = Number(service?.duration) || 30;
    const end = this.addMinutes(start, duration);
    const serviceName = service?.name || 'Booking';

    return {
      summary: `${serviceName} - ${appointment.name}`,
      description: [
        `Kunde: ${appointment.name}`,
        `Email: ${appointment.email}`,
        `Telefon: ${appointment.phone}`,
        `Booking ID: ${appointment.id}`,
      ].join('\n'),
      start: {
        dateTime: start,
        timeZone: this.timeZone,
      },
      end: {
        dateTime: end,
        timeZone: this.timeZone,
      },
      extendedProperties: {
        private: {
          appointmentId: String(appointment.id),
          source: 'securebox-booking',
        },
      },
    };
  }

  buildDateTime(dateValue, timeSlot) {
    const date = dateValue instanceof Date ? dateValue.toISOString().slice(0, 10) : String(dateValue).slice(0, 10);
    return `${date}T${timeSlot}:00`;
  }

  addMinutes(dateTime, minutesToAdd) {
    const [datePart, timePart] = dateTime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute + minutesToAdd, 0));

    const pad = (value) => String(value).padStart(2, '0');
    return [
      `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
      `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`,
    ].join('T');
  }
}

module.exports = GoogleCalendarService;
