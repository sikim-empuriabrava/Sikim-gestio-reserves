import 'server-only';

import type { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const RECENT_LOOKBACK_HOURS = 24;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const PHONE_LIMIT_15_MINUTES = 3;
const PHONE_LIMIT_24_HOURS = 10;
const IP_HASH_LIMIT_15_MINUTES = 5;
const IP_HASH_LIMIT_24_HOURS = 20;
const DEDUPE_IGNORED_STATUSES = new Set(['cancelled', 'no_show']);

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type ExternalReservationAntiAbusePayload = {
  date: string;
  time: string;
  partySize: number;
  phone: string;
  attribution: {
    ipHash: string | null;
  };
};

type GroupEventSnapshot = {
  id: string;
  status: string | null;
  event_date: string | null;
  entry_time: string | null;
  total_pax: number | null;
  adults: number | null;
  children: number | null;
  customer_phone: string | null;
};

type RecentSubmissionRow = {
  submitted_at: string | null;
  ip_hash: string | null;
  group_events: GroupEventSnapshot | GroupEventSnapshot[] | null;
};

export type ExternalReservationAntiAbuseDecision =
  | { action: 'allow' }
  | {
      action: 'deduplicated';
      groupEventId: string;
      status: string;
    }
  | {
      action: 'rate_limited';
      reason: 'phone_15m' | 'phone_24h' | 'ip_hash_15m' | 'ip_hash_24h';
    };

export function normalizeExternalReservationPhoneForComparison(value: string) {
  return value.trim().replace(/[\s()-]/g, '');
}

function normalizeTimeForComparison(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

function getGroupEvent(row: RecentSubmissionRow) {
  if (Array.isArray(row.group_events)) {
    return row.group_events[0] ?? null;
  }

  return row.group_events;
}

function getSubmittedAtTime(row: RecentSubmissionRow) {
  if (!row.submitted_at) {
    return null;
  }

  const time = new Date(row.submitted_at).getTime();
  return Number.isFinite(time) ? time : null;
}

function isWithinWindow(row: RecentSubmissionRow, nowTime: number, windowMs: number) {
  const submittedAtTime = getSubmittedAtTime(row);
  if (submittedAtTime === null) {
    return false;
  }

  const ageMs = nowTime - submittedAtTime;
  return ageMs >= 0 && ageMs <= windowMs;
}

function getTotalPax(groupEvent: GroupEventSnapshot) {
  if (typeof groupEvent.total_pax === 'number') {
    return groupEvent.total_pax;
  }

  return (groupEvent.adults ?? 0) + (groupEvent.children ?? 0);
}

function hasSameNormalizedPhone(row: RecentSubmissionRow, normalizedPhone: string) {
  const groupEvent = getGroupEvent(row);
  if (!groupEvent?.customer_phone) {
    return false;
  }

  return normalizeExternalReservationPhoneForComparison(groupEvent.customer_phone) === normalizedPhone;
}

function countRecentRows(rows: RecentSubmissionRow[], nowTime: number, windowMs: number) {
  return rows.filter((row) => isWithinWindow(row, nowTime, windowMs)).length;
}

function getDuplicateExactMatch(
  rows: RecentSubmissionRow[],
  payload: ExternalReservationAntiAbusePayload,
  normalizedPhone: string,
) {
  return rows.find((row) => {
    const groupEvent = getGroupEvent(row);
    if (!groupEvent) {
      return false;
    }

    if (groupEvent.status && DEDUPE_IGNORED_STATUSES.has(groupEvent.status)) {
      return false;
    }

    return (
      hasSameNormalizedPhone(row, normalizedPhone) &&
      groupEvent.event_date === payload.date &&
      normalizeTimeForComparison(groupEvent.entry_time) === normalizeTimeForComparison(payload.time) &&
      getTotalPax(groupEvent) === payload.partySize
    );
  });
}

export async function checkExternalReservationAntiAbuse(
  supabase: SupabaseAdminClient,
  payload: ExternalReservationAntiAbusePayload,
  now = new Date(),
): Promise<ExternalReservationAntiAbuseDecision> {
  const nowTime = now.getTime();
  const lookbackStart = new Date(nowTime - RECENT_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const normalizedPhone = normalizeExternalReservationPhoneForComparison(payload.phone);

  const { data, error } = await supabase
    .from('external_reservation_submissions')
    .select(
      'submitted_at, ip_hash, group_events!inner(id, status, event_date, entry_time, total_pax, adults, children, customer_phone)',
    )
    .gte('submitted_at', lookbackStart)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[external-reservation] anti-abuse lookup failed', {
      eventDate: payload.date,
      entryTime: payload.time,
      partySize: payload.partySize,
      error,
    });
    return { action: 'allow' };
  }

  const rows = (data ?? []) as RecentSubmissionRow[];
  const phoneRows = rows.filter((row) => hasSameNormalizedPhone(row, normalizedPhone));
  const duplicateRow = getDuplicateExactMatch(phoneRows, payload, normalizedPhone);
  const duplicateGroupEvent = duplicateRow ? getGroupEvent(duplicateRow) : null;

  if (duplicateGroupEvent) {
    return {
      action: 'deduplicated',
      groupEventId: duplicateGroupEvent.id,
      status: duplicateGroupEvent.status ?? 'pending',
    };
  }

  if (countRecentRows(phoneRows, nowTime, FIFTEEN_MINUTES_MS) >= PHONE_LIMIT_15_MINUTES) {
    return { action: 'rate_limited', reason: 'phone_15m' };
  }

  if (countRecentRows(phoneRows, nowTime, TWENTY_FOUR_HOURS_MS) >= PHONE_LIMIT_24_HOURS) {
    return { action: 'rate_limited', reason: 'phone_24h' };
  }

  if (payload.attribution.ipHash) {
    const ipHashRows = rows.filter((row) => row.ip_hash === payload.attribution.ipHash);

    if (countRecentRows(ipHashRows, nowTime, FIFTEEN_MINUTES_MS) >= IP_HASH_LIMIT_15_MINUTES) {
      return { action: 'rate_limited', reason: 'ip_hash_15m' };
    }

    if (countRecentRows(ipHashRows, nowTime, TWENTY_FOUR_HOURS_MS) >= IP_HASH_LIMIT_24_HOURS) {
      return { action: 'rate_limited', reason: 'ip_hash_24h' };
    }
  }

  return { action: 'allow' };
}
