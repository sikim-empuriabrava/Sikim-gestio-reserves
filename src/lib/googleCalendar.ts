import { calendar_v3, google } from 'googleapis';

const calendar = google.calendar('v3');

function getJwtClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const impersonatedUser = process.env.GOOGLE_CALENDAR_IMPERSONATED_USER;

  if (!clientEmail || !privateKey || !calendarId || !impersonatedUser) {
    throw new Error('Missing Google Calendar environment variables');
  }

  const jwtClient = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    subject: impersonatedUser,
  });

  return jwtClient;
}

export type CalendarEventPayload = {
  summary: string;
  description?: string | null;
  allDay: boolean;
  // Para eventos de todo el día
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD' (día siguiente, exclusivo)
  // Para eventos con hora (por si en el futuro los usamos)
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
};

export async function createCalendarEvent(
  payload: CalendarEventPayload
): Promise<string> {
  const auth = getJwtClient();
  await auth.authorize();

  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  const { allDay, startDate, endDate, startDateTime, endDateTime, timeZone } = payload;

  let start: calendar_v3.Schema$EventDateTime;
  let end: calendar_v3.Schema$EventDateTime;

  if (allDay) {
    if (!startDate || !endDate) {
      throw new Error('Missing startDate/endDate for all-day event');
    }
    start = { date: startDate };
    end = { date: endDate };
  } else {
    if (!startDateTime || !endDateTime || !timeZone) {
      throw new Error('Missing dateTime/timeZone for timed event');
    }
    start = { dateTime: startDateTime, timeZone };
    end = { dateTime: endDateTime, timeZone };
  }

  const res = await calendar.events.insert({
    auth,
    calendarId,
    requestBody: {
      summary: payload.summary,
      description: payload.description ?? undefined,
      start,
      end,
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

  const { allDay, startDate, endDate, startDateTime, endDateTime, timeZone } = payload;

  let start: calendar_v3.Schema$EventDateTime;
  let end: calendar_v3.Schema$EventDateTime;

  if (allDay) {
    if (!startDate || !endDate) {
      throw new Error('Missing startDate/endDate for all-day event');
    }
    start = { date: startDate };
    end = { date: endDate };
  } else {
    if (!startDateTime || !endDateTime || !timeZone) {
      throw new Error('Missing dateTime/timeZone for timed event');
    }
    start = { dateTime: startDateTime, timeZone };
    end = { dateTime: endDateTime, timeZone };
  }

  await calendar.events.update({
    auth,
    calendarId,
    eventId,
    requestBody: {
      summary: payload.summary,
      description: payload.description ?? undefined,
      start,
      end,
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
