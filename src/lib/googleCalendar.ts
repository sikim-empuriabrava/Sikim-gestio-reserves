import { google } from 'googleapis';

const calendar = google.calendar('v3');

function getJwtClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!clientEmail || !privateKey || !calendarId) {
    throw new Error('Missing Google Calendar environment variables');
  }

  const jwtClient = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return jwtClient;
}

export type CalendarEventPayload = {
  summary: string;
  description?: string | null;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
};

export async function createCalendarEvent(
  payload: CalendarEventPayload
): Promise<string> {
  const auth = getJwtClient();
  await auth.authorize();

  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  const res = await calendar.events.insert({
    auth,
    calendarId,
    requestBody: {
      summary: payload.summary,
      description: payload.description ?? undefined,
      start: {
        dateTime: payload.startDateTime,
        timeZone: payload.timeZone,
      },
      end: {
        dateTime: payload.endDateTime,
        timeZone: payload.timeZone,
      },
    },
  });

  if (!res.data.id) {
    throw new Error('Google Calendar: created event without id');
  }

  return res.data.id;
}

export async function updateCalendarEvent(
  eventId: string,
  payload: CalendarEventPayload
): Promise<void> {
  const auth = getJwtClient();
  await auth.authorize();

  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  await calendar.events.update({
    auth,
    calendarId,
    eventId,
    requestBody: {
      summary: payload.summary,
      description: payload.description ?? undefined,
      start: {
        dateTime: payload.startDateTime,
        timeZone: payload.timeZone,
      },
      end: {
        dateTime: payload.endDateTime,
        timeZone: payload.timeZone,
      },
    },
  });
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const auth = getJwtClient();
  await auth.authorize();

  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  await calendar.events.delete({
    auth,
    calendarId,
    eventId,
  });
}
