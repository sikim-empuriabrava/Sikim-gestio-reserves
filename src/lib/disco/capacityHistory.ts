import 'server-only';

import { DEFAULT_VENUE_SLUG } from '@/lib/disco/liveCapacity';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type HistoryRange = 'today' | '7d' | '30d' | 'all';

type SessionRow = {
  id: string;
  venue_slug: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  current_count: number;
  peak_count: number;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  session_id: string;
  delta: number;
  resulting_count: number;
  actor_email: string | null;
  note: string | null;
  created_at: string;
};

export type SessionMetrics = {
  total_entries: number;
  total_exits: number;
  event_count: number;
  duration_minutes: number;
};

export type CapacitySessionHistoryItem = {
  session: SessionRow;
  metrics: SessionMetrics;
};

export type CapacitySessionHistoryDetail = {
  session: SessionRow;
  metrics: SessionMetrics;
  events: EventRow[];
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeUuid(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  return UUID_REGEX.test(trimmedValue) ? trimmedValue : null;
}

function getTodayStartDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function getRangeFromDate(range: HistoryRange): Date | null {
  if (range === 'all') return null;

  if (range === 'today') {
    return getTodayStartDate();
  }

  const now = new Date();
  const days = range === '7d' ? 7 : 30;
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  return since;
}

function buildSessionMetrics(session: SessionRow, events: EventRow[]): SessionMetrics {
  const totalEntries = events.reduce((sum, event) => (event.delta > 0 ? sum + event.delta : sum), 0);
  const totalExits = events.reduce((sum, event) => (event.delta < 0 ? sum + Math.abs(event.delta) : sum), 0);

  const openedAtMs = new Date(session.opened_at).getTime();
  const closedAtMs = session.closed_at ? new Date(session.closed_at).getTime() : Date.now();
  const durationMs = Number.isFinite(openedAtMs) && Number.isFinite(closedAtMs) ? Math.max(closedAtMs - openedAtMs, 0) : 0;

  return {
    total_entries: totalEntries,
    total_exits: totalExits,
    event_count: events.length,
    duration_minutes: Math.round(durationMs / 60000),
  };
}

export function parseHistoryRange(rawValue: string | null | undefined): HistoryRange {
  if (rawValue === 'today' || rawValue === '7d' || rawValue === '30d' || rawValue === 'all') {
    return rawValue;
  }

  return '7d';
}

export async function listClosedCapacitySessionsWithMetrics(params?: {
  range?: HistoryRange;
  limit?: number;
  venueSlug?: string;
}): Promise<CapacitySessionHistoryItem[]> {
  const range = params?.range ?? '7d';
  const venueSlug = params?.venueSlug ?? DEFAULT_VENUE_SLUG;
  const limit = params?.limit ?? 50;

  const supabase = createSupabaseAdminClient();
  const sinceDate = getRangeFromDate(range);

  let sessionsQuery = supabase
    .from('discotheque_capacity_sessions')
    .select('*')
    .eq('venue_slug', venueSlug)
    .eq('status', 'closed')
    .order('opened_at', { ascending: false })
    .limit(limit);

  if (sinceDate) {
    sessionsQuery = sessionsQuery.gte('opened_at', sinceDate.toISOString());
  }

  const { data: sessionsData, error: sessionsError } = await sessionsQuery;

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const sessions = (sessionsData ?? []) as SessionRow[];

  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((session) => session.id);
  const { data: eventsData, error: eventsError } = await supabase
    .from('discotheque_capacity_events')
    .select('*')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const events = (eventsData ?? []) as EventRow[];
  const eventsBySession = new Map<string, EventRow[]>();

  for (const event of events) {
    const bucket = eventsBySession.get(event.session_id);
    if (bucket) {
      bucket.push(event);
    } else {
      eventsBySession.set(event.session_id, [event]);
    }
  }

  return sessions.map((session) => {
    const sessionEvents = eventsBySession.get(session.id) ?? [];

    return {
      session,
      metrics: buildSessionMetrics(session, sessionEvents),
    };
  });
}

export async function getClosedCapacitySessionDetail(params: {
  sessionId: string;
  venueSlug?: string;
}): Promise<CapacitySessionHistoryDetail | null> {
  const normalizedSessionId = normalizeUuid(params.sessionId);
  if (!normalizedSessionId) {
    return null;
  }

  const venueSlug = params.venueSlug ?? DEFAULT_VENUE_SLUG;
  const supabase = createSupabaseAdminClient();

  const { data: sessionData, error: sessionError } = await supabase
    .from('discotheque_capacity_sessions')
    .select('*')
    .eq('id', normalizedSessionId)
    .eq('venue_slug', venueSlug)
    .eq('status', 'closed')
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!sessionData) {
    return null;
  }

  const session = sessionData as SessionRow;

  const { data: eventsData, error: eventsError } = await supabase
    .from('discotheque_capacity_events')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const events = (eventsData ?? []) as EventRow[];

  return {
    session,
    metrics: buildSessionMetrics(session, events),
    events,
  };
}
