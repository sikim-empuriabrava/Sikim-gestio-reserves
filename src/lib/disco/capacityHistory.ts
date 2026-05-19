import 'server-only';

import { DEFAULT_VENUE_SLUG } from '@/lib/disco/liveCapacity';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type HistoryRange = 'today' | '7d' | '30d' | 'all';
export type HistoryTab = 'sessions' | 'insights';
export type WeekdayFilter = 'all' | '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type WeekdayValue = Exclude<WeekdayFilter, 'all'>;

export type SessionRow = {
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

export type EventRow = {
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
  peak_time_at: string | null;
};

export type CapacitySessionHistoryItem = {
  session: SessionRow;
  metrics: SessionMetrics;
};

export type CapacitySessionHistoryDetail = {
  session: SessionRow;
  metrics: SessionMetrics;
  events: EventRow[];
  evolution: ChartPoint[];
};

export type HistoryFilters = {
  range: HistoryRange;
  tab: HistoryTab;
  from: string | null;
  to: string | null;
  weekdays: WeekdayValue[];
  hasManualRange: boolean;
  dateNotice: string | null;
};

export type ChartPoint = {
  label: string;
  value: number;
  iso?: string;
};

export type SessionBarPoint = {
  sessionId: string;
  label: string;
  value: number;
  secondary?: string;
};

export type WeekdayChartPoint = {
  weekday: string;
  entries: number;
  averagePeak: number;
  sessions: number;
};

export type OperationalDayTraffic = {
  date: string;
  label: string;
  entries: number;
};

export type AverageCapacitySlot = {
  label: string;
  averageCount: number;
};

export type CapacityHistoryInsights = {
  closedSessions: number;
  totalEntries: number;
  averageEntriesPerSession: number;
  totalExits: number;
  totalMovements: number;
  rangePeak: number;
  averagePeak: number;
  averageFinal: number;
  averageDurationMinutes: number;
  bestByPeak: CapacitySessionHistoryItem | null;
  bestByEntries: CapacitySessionHistoryItem | null;
  bestOperationalDay: OperationalDayTraffic | null;
  weekdayWithMostTraffic: string | null;
  approximatePeakHour: string | null;
  strongestAverageCapacitySlot: AverageCapacitySlot | null;
  averageEvolution: ChartPoint[];
  entriesBySession: SessionBarPoint[];
  peakBySession: SessionBarPoint[];
  weekdayComparison: WeekdayChartPoint[];
};

export type CapacityHistoryDataset = {
  sessions: CapacitySessionHistoryItem[];
  insights: CapacityHistoryInsights;
  limit: number;
  isLimited: boolean;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DISCO_TIME_ZONE = 'Europe/Madrid';
// Europe/Madrid is used as the operational timezone so DST changes are handled by the runtime timezone database instead of fixed UTC offsets.

const WEEKDAY_LABELS: Record<WeekdayValue, string> = {
  '1': 'Lunes',
  '2': 'Martes',
  '3': 'Miercoles',
  '4': 'Jueves',
  '5': 'Viernes',
  '6': 'Sabado',
  '7': 'Domingo',
};

const HISTORY_LIMIT_DEFAULT = 300;
const CHART_SESSION_LIMIT = 40;
const CAPACITY_EVENTS_PAGE_SIZE = 1000;
const LOCAL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type LocalDateTimeParts = LocalDateParts & {
  hour: number;
  minute: number;
  second: number;
};

const localDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISCO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const discoDateFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: DISCO_TIME_ZONE,
  dateStyle: 'medium',
});

const discoDateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: DISCO_TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

const discoTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: DISCO_TIME_ZONE,
  timeStyle: 'short',
});

const discoShortDateFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: DISCO_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
});

export function normalizeUuid(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  return UUID_REGEX.test(trimmedValue) ? trimmedValue : null;
}

export function parseHistoryRange(rawValue: string | null | undefined): HistoryRange {
  if (rawValue === 'today' || rawValue === '7d' || rawValue === '30d' || rawValue === 'all') {
    return rawValue;
  }

  return '7d';
}

export function parseHistoryTab(rawValue: string | null | undefined): HistoryTab {
  if (rawValue === 'insights') return 'insights';
  return 'sessions';
}

function isWeekdayValue(rawValue: string | null | undefined): rawValue is WeekdayValue {
  if (rawValue === '1' || rawValue === '2' || rawValue === '3' || rawValue === '4' || rawValue === '5' || rawValue === '6' || rawValue === '7') {
    return true;
  }

  return false;
}

export function parseWeekdayFilter(rawValue: string | null | undefined): WeekdayFilter {
  return isWeekdayValue(rawValue) ? rawValue : 'all';
}

export function parseWeekdayFilters(rawValue: string | null | undefined, legacyValue?: string | null | undefined): WeekdayValue[] {
  const source = rawValue || legacyValue;
  if (!source || source === 'all') return [];

  const weekdays = source
    .split(',')
    .map((value) => value.trim())
    .filter(isWeekdayValue);

  return Array.from(new Set(weekdays));
}

export function getWeekdayLabel(weekday: WeekdayFilter): string {
  if (weekday === 'all') return 'Todos';
  return WEEKDAY_LABELS[weekday];
}

export function getWeekdayFilterLabel(weekdays: WeekdayValue[]): string {
  if (weekdays.length === 0) return 'Todos';
  return weekdays.map((weekday) => WEEKDAY_LABELS[weekday]).join(', ');
}

function parseDateInput(value: string | null | undefined): LocalDateParts | null {
  if (!value || !LOCAL_DATE_REGEX.test(value)) return null;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

function formatDateInput(date: LocalDateParts): string {
  const year = String(date.year).padStart(4, '0');
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDateTimeParts(date: Date): LocalDateTimeParts {
  const parts = localDateTimeFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const hour = value('hour');

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: hour === 24 ? 0 : hour,
    minute: value('minute'),
    second: value('second'),
  };
}

function getTimeZoneOffsetMs(date: Date): number {
  const parts = getLocalDateTimeParts(date);
  const localAsUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return localAsUtcMs - Math.floor(date.getTime() / 1000) * 1000;
}

function makeDiscoLocalDateTime(parts: LocalDateParts, hour = 0, minute = 0, second = 0, millisecond = 0): Date {
  const localAsUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second, millisecond);
  let utcMs = localAsUtcMs - getTimeZoneOffsetMs(new Date(localAsUtcMs));
  utcMs = localAsUtcMs - getTimeZoneOffsetMs(new Date(utcMs));
  return new Date(utcMs);
}

function getTodayLocalDate(): LocalDateParts {
  const now = getLocalDateTimeParts(new Date());
  return { year: now.year, month: now.month, day: now.day };
}

export function parseHistoryFilters(searchParams?: Record<string, string | string[] | undefined>): HistoryFilters {
  const raw = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const range = parseHistoryRange(raw('range'));
  const tab = parseHistoryTab(raw('tab'));
  const weekdays = parseWeekdayFilters(raw('weekdays'), raw('weekday'));
  const fromDate = parseDateInput(raw('from'));
  const toDate = parseDateInput(raw('to'));
  let dateNotice: string | null = null;

  if ((raw('from') && !fromDate) || (raw('to') && !toDate)) {
    dateNotice = 'Alguna fecha no era valida; se ha usado el rango rapido.';
  }

  if (fromDate && toDate) {
    if (formatDateInput(fromDate) > formatDateInput(toDate)) {
      dateNotice = 'El rango estaba invertido; se ha corregido automaticamente.';
      return {
        range,
        tab,
        from: formatDateInput(toDate),
        to: formatDateInput(fromDate),
        weekdays,
        hasManualRange: true,
        dateNotice,
      };
    }

    return {
      range,
      tab,
      from: formatDateInput(fromDate),
      to: formatDateInput(toDate),
      weekdays,
      hasManualRange: true,
      dateNotice,
    };
  }

  if (fromDate || toDate) {
    return {
      range,
      tab,
      from: fromDate ? formatDateInput(fromDate) : null,
      to: toDate ? formatDateInput(toDate) : null,
      weekdays,
      hasManualRange: true,
      dateNotice,
    };
  }

  return {
    range,
    tab,
    from: null,
    to: null,
    weekdays,
    hasManualRange: false,
    dateNotice,
  };
}

function getTodayStartDate(): Date {
  return makeDiscoLocalDateTime(getTodayLocalDate(), 0, 0, 0, 0);
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

function endOfDay(value: string): Date {
  const date = parseDateInput(value) ?? getTodayLocalDate();
  return makeDiscoLocalDateTime(date, 23, 59, 59, 999);
}

function getDateWindow(filters: HistoryFilters): { from: Date | null; to: Date | null } {
  if (filters.hasManualRange) {
    return {
      from: filters.from ? makeDiscoLocalDateTime(parseDateInput(filters.from) ?? getTodayLocalDate(), 0, 0, 0, 0) : null,
      to: filters.to ? endOfDay(filters.to) : null,
    };
  }

  return { from: getRangeFromDate(filters.range), to: null };
}

export function getSessionWeekdayFilterValue(openedAt: string): WeekdayValue {
  const date = new Date(openedAt);
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: DISCO_TIME_ZONE, weekday: 'short' }).format(date);
  const weekdayMap: Record<string, WeekdayValue> = {
    Mon: '1',
    Tue: '2',
    Wed: '3',
    Thu: '4',
    Fri: '5',
    Sat: '6',
    Sun: '7',
  };
  return weekdayMap[weekday] ?? '1';
}

function formatShortSessionLabel(openedAt: string): string {
  return discoShortDateFormatter.format(new Date(openedAt));
}

function formatOperationalDayKey(openedAt: string): string {
  const parts = getLocalDateTimeParts(new Date(openedAt));
  return formatDateInput(parts);
}

export function formatDiscoDate(value: string | null | undefined): string {
  if (!value) return '-';
  return discoDateFormatter.format(new Date(value));
}

export function formatDiscoDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return discoDateTimeFormatter.format(new Date(value));
}

export function formatDiscoTime(value: string | null | undefined): string {
  if (!value) return '-';
  return discoTimeFormatter.format(new Date(value));
}

function formatTimeLabel(value: Date): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: DISCO_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
}

function formatSlotTimeLabel(minutes: number): string {
  const normalizedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatSlotRangeLabel(slotStartMinutes: number, intervalMinutes: number): string {
  return `${formatSlotTimeLabel(slotStartMinutes)}-${formatSlotTimeLabel(slotStartMinutes + intervalMinutes)}`;
}

function minutesSinceMidnight(value: Date): number {
  const local = getLocalDateTimeParts(value);
  const minutes = local.hour * 60 + local.minute;
  return local.hour < 12 ? minutes + 24 * 60 : minutes;
}

function buildSessionMetrics(session: SessionRow, events: EventRow[]): SessionMetrics {
  let totalEntries = 0;
  let totalExits = 0;
  let peakTimeAt: string | null = null;

  for (const event of events) {
    if (event.delta > 0) totalEntries += event.delta;
    if (event.delta < 0) totalExits += Math.abs(event.delta);
    if (!peakTimeAt && event.resulting_count === session.peak_count) {
      peakTimeAt = event.created_at;
    }
  }

  const openedAtMs = new Date(session.opened_at).getTime();
  const closedAtMs = session.closed_at ? new Date(session.closed_at).getTime() : Date.now();
  const durationMs = Number.isFinite(openedAtMs) && Number.isFinite(closedAtMs) ? Math.max(closedAtMs - openedAtMs, 0) : 0;

  return {
    total_entries: totalEntries,
    total_exits: totalExits,
    event_count: events.length,
    duration_minutes: Math.round(durationMs / 60000),
    peak_time_at: peakTimeAt,
  };
}

function groupEventsBySession(events: EventRow[]): Map<string, EventRow[]> {
  const eventsBySession = new Map<string, EventRow[]>();

  for (const event of events) {
    const bucket = eventsBySession.get(event.session_id);
    if (bucket) {
      bucket.push(event);
    } else {
      eventsBySession.set(event.session_id, [event]);
    }
  }

  return eventsBySession;
}

function buildSessionEvolution(session: SessionRow, events: EventRow[]): ChartPoint[] {
  const points: ChartPoint[] = [{ label: formatTimeLabel(new Date(session.opened_at)), value: 0, iso: session.opened_at }];

  for (const event of events) {
    points.push({ label: formatTimeLabel(new Date(event.created_at)), value: event.resulting_count, iso: event.created_at });
  }

  if (session.closed_at && points[points.length - 1]?.iso !== session.closed_at) {
    points.push({ label: formatTimeLabel(new Date(session.closed_at)), value: session.current_count, iso: session.closed_at });
  }

  return points;
}

function buildAverageEvolution(itemsWithEvents: Array<CapacitySessionHistoryItem & { events: EventRow[] }>): ChartPoint[] {
  const bins = new Map<string, { sum: number; count: number; order: number }>();
  const intervalMinutes = 15;

  for (const item of itemsWithEvents) {
    if (!item.session.closed_at) continue;

    const openedAt = new Date(item.session.opened_at);
    const closedAt = new Date(item.session.closed_at);
    if (!Number.isFinite(openedAt.getTime()) || !Number.isFinite(closedAt.getTime()) || closedAt <= openedAt) continue;

    const events = [...item.events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const openedLocal = getLocalDateTimeParts(openedAt);
    const minuteRemainder = openedLocal.minute % intervalMinutes;
    const minutesToAdd = minuteRemainder !== 0 || openedLocal.second ? intervalMinutes - minuteRemainder : 0;
    const cursor = new Date(openedAt.getTime() + minutesToAdd * 60000);
    const cursorLocal = getLocalDateTimeParts(cursor);
    cursor.setSeconds(cursor.getSeconds() - cursorLocal.second, 0);

    let eventIndex = 0;
    let lastKnownCount = 0;

    while (cursor <= closedAt) {
      const cursorMs = cursor.getTime();
      while (eventIndex < events.length && new Date(events[eventIndex].created_at).getTime() <= cursorMs) {
        lastKnownCount = events[eventIndex].resulting_count;
        eventIndex += 1;
      }

      const label = formatTimeLabel(cursor);
      const order = minutesSinceMidnight(cursor);
      const current = bins.get(label) ?? { sum: 0, count: 0, order };
      current.sum += lastKnownCount;
      current.count += 1;
      current.order = Math.min(current.order, order);
      bins.set(label, current);

      cursor.setMinutes(cursor.getMinutes() + intervalMinutes);
    }
  }

  return Array.from(bins.entries())
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([label, bucket]) => ({ label, value: Math.round(bucket.sum / bucket.count) }));
}

function addWeightedIntervalToCapacitySlots(
  bins: Map<number, { weightedCountMs: number; durationMs: number }>,
  from: Date,
  to: Date,
  count: number,
  intervalMinutes: number,
) {
  let cursor = new Date(from.getTime());

  while (cursor < to) {
    const local = getLocalDateTimeParts(cursor);
    const order = minutesSinceMidnight(cursor);
    const slotStart = Math.floor(order / intervalMinutes) * intervalMinutes;
    const elapsedMsInSlot =
      ((local.minute % intervalMinutes) * 60 + local.second) * 1000 + cursor.getMilliseconds();
    const msUntilNextSlot = Math.max(1, intervalMinutes * 60000 - elapsedMsInSlot);
    const segmentEnd = new Date(Math.min(to.getTime(), cursor.getTime() + msUntilNextSlot));
    const durationMs = segmentEnd.getTime() - cursor.getTime();

    if (durationMs > 0) {
      const bucket = bins.get(slotStart) ?? { weightedCountMs: 0, durationMs: 0 };
      bucket.weightedCountMs += count * durationMs;
      bucket.durationMs += durationMs;
      bins.set(slotStart, bucket);
    }

    cursor = segmentEnd;
  }
}

function buildStrongestAverageCapacitySlot(itemsWithEvents: Array<CapacitySessionHistoryItem & { events: EventRow[] }>): AverageCapacitySlot | null {
  const intervalMinutes = 30;
  const bins = new Map<number, { weightedCountMs: number; durationMs: number }>();
  let hasEvents = false;

  for (const item of itemsWithEvents) {
    if (!item.session.closed_at || item.events.length === 0) continue;

    const openedAt = new Date(item.session.opened_at);
    const closedAt = new Date(item.session.closed_at);
    if (!Number.isFinite(openedAt.getTime()) || !Number.isFinite(closedAt.getTime()) || closedAt <= openedAt) continue;

    const events = [...item.events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let previousAt = openedAt;
    let currentCount = 0;

    for (const event of events) {
      const eventAt = new Date(event.created_at);
      if (!Number.isFinite(eventAt.getTime())) continue;

      if (eventAt < openedAt) {
        currentCount = event.resulting_count;
        continue;
      }

      if (eventAt > closedAt) break;

      addWeightedIntervalToCapacitySlots(bins, previousAt, eventAt, currentCount, intervalMinutes);
      currentCount = event.resulting_count;
      previousAt = eventAt;
      hasEvents = true;
    }

    addWeightedIntervalToCapacitySlots(bins, previousAt, closedAt, currentCount, intervalMinutes);
  }

  if (!hasEvents || bins.size === 0) return null;

  const strongest = Array.from(bins.entries()).reduce<{ slotStart: number; averageCount: number } | null>((best, [slotStart, bucket]) => {
    if (bucket.durationMs <= 0) return best;

    const averageCount = Math.round(bucket.weightedCountMs / bucket.durationMs);
    if (!best || averageCount > best.averageCount) return { slotStart, averageCount };
    return best;
  }, null);

  if (!strongest) return null;

  return {
    label: formatSlotRangeLabel(strongest.slotStart, intervalMinutes),
    averageCount: strongest.averageCount,
  };
}

function buildInsights(itemsWithEvents: Array<CapacitySessionHistoryItem & { events: EventRow[] }>): CapacityHistoryInsights {
  const items = itemsWithEvents.map((item) => ({ session: item.session, metrics: item.metrics }));
  const closedSessions = items.length;
  const totalEntries = items.reduce((sum, item) => sum + item.metrics.total_entries, 0);
  const averageEntriesPerSession = closedSessions ? Math.round(totalEntries / closedSessions) : 0;
  const totalExits = items.reduce((sum, item) => sum + item.metrics.total_exits, 0);
  const totalMovements = items.reduce((sum, item) => sum + item.metrics.event_count, 0);
  const rangePeak = items.reduce((max, item) => Math.max(max, item.session.peak_count), 0);
  const averagePeak = closedSessions ? Math.round(items.reduce((sum, item) => sum + item.session.peak_count, 0) / closedSessions) : 0;
  const averageFinal = closedSessions ? Math.round(items.reduce((sum, item) => sum + item.session.current_count, 0) / closedSessions) : 0;
  const averageDurationMinutes = closedSessions ? Math.round(items.reduce((sum, item) => sum + item.metrics.duration_minutes, 0) / closedSessions) : 0;
  const bestByPeak = items.reduce<CapacitySessionHistoryItem | null>((best, item) => (!best || item.session.peak_count > best.session.peak_count ? item : best), null);
  const bestByEntries = items.reduce<CapacitySessionHistoryItem | null>((best, item) => (!best || item.metrics.total_entries > best.metrics.total_entries ? item : best), null);
  const averageEvolution = buildAverageEvolution(itemsWithEvents);
  const peakEvolutionPoint = averageEvolution.reduce<ChartPoint | null>((best, point) => (!best || point.value > best.value ? point : best), null);
  const strongestAverageCapacitySlot = buildStrongestAverageCapacitySlot(itemsWithEvents);

  const weekdayBuckets = new Map<WeekdayFilter, { entries: number; peakSum: number; sessions: number }>();
  for (const weekday of ['1', '2', '3', '4', '5', '6', '7'] as const) {
    weekdayBuckets.set(weekday, { entries: 0, peakSum: 0, sessions: 0 });
  }

  const operationalDayBuckets = new Map<string, OperationalDayTraffic>();

  for (const item of items) {
    const weekday = getSessionWeekdayFilterValue(item.session.opened_at);
    const bucket = weekdayBuckets.get(weekday);
    if (!bucket) continue;
    bucket.entries += item.metrics.total_entries;
    bucket.peakSum += item.session.peak_count;
    bucket.sessions += 1;

    const operationalDayKey = formatOperationalDayKey(item.session.opened_at);
    const operationalDayBucket = operationalDayBuckets.get(operationalDayKey) ?? {
      date: operationalDayKey,
      label: formatDiscoDate(item.session.opened_at),
      entries: 0,
    };
    operationalDayBucket.entries += item.metrics.total_entries;
    operationalDayBuckets.set(operationalDayKey, operationalDayBucket);
  }

  const weekdayComparison = Array.from(weekdayBuckets.entries()).map(([weekday, bucket]) => ({
    weekday: getWeekdayLabel(weekday),
    entries: bucket.entries,
    averagePeak: bucket.sessions ? Math.round(bucket.peakSum / bucket.sessions) : 0,
    sessions: bucket.sessions,
  }));

  const weekdayWithMostTraffic = weekdayComparison.reduce<WeekdayChartPoint | null>(
    (best, point) => (!best || point.entries > best.entries ? point : best),
    null,
  );
  const bestOperationalDay = Array.from(operationalDayBuckets.values()).reduce<OperationalDayTraffic | null>(
    (best, day) => (!best || day.entries > best.entries ? day : best),
    null,
  );

  const chartSource = [...items].reverse().slice(-CHART_SESSION_LIMIT);

  return {
    closedSessions,
    totalEntries,
    averageEntriesPerSession,
    totalExits,
    totalMovements,
    rangePeak,
    averagePeak,
    averageFinal,
    averageDurationMinutes,
    bestByPeak,
    bestByEntries,
    bestOperationalDay: bestOperationalDay && bestOperationalDay.entries > 0 ? bestOperationalDay : null,
    weekdayWithMostTraffic: weekdayWithMostTraffic && weekdayWithMostTraffic.entries > 0 ? weekdayWithMostTraffic.weekday : null,
    approximatePeakHour: peakEvolutionPoint ? peakEvolutionPoint.label : null,
    strongestAverageCapacitySlot,
    averageEvolution,
    entriesBySession: chartSource.map((item) => ({
      sessionId: item.session.id,
      label: formatShortSessionLabel(item.session.opened_at),
      value: item.metrics.total_entries,
      secondary: getWeekdayLabel(getSessionWeekdayFilterValue(item.session.opened_at)),
    })),
    peakBySession: chartSource.map((item) => ({
      sessionId: item.session.id,
      label: formatShortSessionLabel(item.session.opened_at),
      value: item.session.peak_count,
      secondary: getWeekdayLabel(getSessionWeekdayFilterValue(item.session.opened_at)),
    })),
    weekdayComparison,
  };
}

async function fetchCapacityEventsBySessionIds(
  supabase: SupabaseAdminClient,
  sessionIds: string[],
): Promise<EventRow[]> {
  if (sessionIds.length === 0) return [];

  const events: EventRow[] = [];
  let from = 0;

  while (true) {
    const to = from + CAPACITY_EVENTS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('discotheque_capacity_events')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as EventRow[];
    events.push(...batch);

    if (batch.length < CAPACITY_EVENTS_PAGE_SIZE) {
      break;
    }

    from += CAPACITY_EVENTS_PAGE_SIZE;
  }

  return events;
}

export async function listClosedCapacitySessionsWithMetrics(params?: {
  range?: HistoryRange;
  limit?: number;
  venueSlug?: string;
}): Promise<CapacitySessionHistoryItem[]> {
  const filters: HistoryFilters = {
    range: params?.range ?? '7d',
    tab: 'sessions',
    from: null,
    to: null,
    weekdays: [],
    hasManualRange: false,
    dateNotice: null,
  };

  const dataset = await getCapacityHistoryDataset({ filters, limit: params?.limit, venueSlug: params?.venueSlug });
  return dataset.sessions;
}

export async function getCapacityHistoryDataset(params: {
  filters: HistoryFilters;
  limit?: number;
  venueSlug?: string;
}): Promise<CapacityHistoryDataset> {
  const filters = params.filters;
  const venueSlug = params.venueSlug ?? DEFAULT_VENUE_SLUG;
  const limit = params.limit ?? HISTORY_LIMIT_DEFAULT;
  const supabase = createSupabaseAdminClient();
  const dateWindow = getDateWindow(filters);

  let sessionsQuery = supabase
    .from('discotheque_capacity_sessions')
    .select('*')
    .eq('venue_slug', venueSlug)
    .eq('status', 'closed')
    .order('opened_at', { ascending: false })
    .limit(limit);

  if (dateWindow.from) {
    sessionsQuery = sessionsQuery.gte('opened_at', dateWindow.from.toISOString());
  }

  if (dateWindow.to) {
    sessionsQuery = sessionsQuery.lte('opened_at', dateWindow.to.toISOString());
  }

  const { data: sessionsData, error: sessionsError } = await sessionsQuery;

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const rawSessions = (sessionsData ?? []) as SessionRow[];
  const selectedWeekdays = new Set(filters.weekdays);
  const sessions = selectedWeekdays.size === 0
    ? rawSessions
    : rawSessions.filter((session) => selectedWeekdays.has(getSessionWeekdayFilterValue(session.opened_at)));

  if (sessions.length === 0) {
    return {
      sessions: [],
      insights: buildInsights([]),
      limit,
      isLimited: rawSessions.length >= limit,
    };
  }

  const sessionIds = sessions.map((session) => session.id);
  const events = await fetchCapacityEventsBySessionIds(supabase, sessionIds);
  const eventsBySession = groupEventsBySession(events);
  const itemsWithEvents = sessions.map((session) => {
    const sessionEvents = eventsBySession.get(session.id) ?? [];

    return {
      session,
      metrics: buildSessionMetrics(session, sessionEvents),
      events: sessionEvents,
    };
  });

  return {
    sessions: itemsWithEvents.map((item) => ({ session: item.session, metrics: item.metrics })),
    insights: buildInsights(itemsWithEvents),
    limit,
    isLimited: rawSessions.length >= limit,
  };
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

  const events = await fetchCapacityEventsBySessionIds(supabase, [session.id]);

  return {
    session,
    metrics: buildSessionMetrics(session, events),
    events,
    evolution: buildSessionEvolution(session, events),
  };
}
