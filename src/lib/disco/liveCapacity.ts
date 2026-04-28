import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const DEFAULT_VENUE_SLUG = 'sikim-discoteca';
const RECENT_EVENTS_LIMIT = 12;

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

export type LiveCapacityState = {
  activeSession: SessionRow | null;
  peakAt: string | null;
  recentEvents: EventRow[];
  latestEvent: EventRow | null;
};

export async function getLiveCapacityState(venueSlug = DEFAULT_VENUE_SLUG): Promise<LiveCapacityState> {
  const supabase = createSupabaseAdminClient();
  const { data: activeSession } = await supabase
    .from('discotheque_capacity_sessions')
    .select('*')
    .eq('venue_slug', venueSlug)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle<SessionRow>();

  if (!activeSession) {
    return {
      activeSession: null,
      peakAt: null,
      recentEvents: [],
      latestEvent: null,
    };
  }

  const { data: recentEvents } = await supabase
    .from('discotheque_capacity_events')
    .select('*')
    .eq('session_id', activeSession.id)
    .order('created_at', { ascending: false })
    .limit(RECENT_EVENTS_LIMIT);

  const normalizedEvents = (recentEvents ?? []) as EventRow[];
  let peakAt: string | null = null;

  if (activeSession.peak_count > 0) {
    const { data: peakEvent } = await supabase
      .from('discotheque_capacity_events')
      .select('created_at')
      .eq('session_id', activeSession.id)
      .eq('resulting_count', activeSession.peak_count)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<Pick<EventRow, 'created_at'>>();

    peakAt = peakEvent?.created_at ?? null;
  }

  return {
    activeSession,
    peakAt,
    recentEvents: normalizedEvents,
    latestEvent: normalizedEvents[0] ?? null,
  };
}

export async function openLiveCapacitySession(actorEmail: string, venueSlug = DEFAULT_VENUE_SLUG) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('open_discotheque_capacity_session', {
    p_actor_email: actorEmail,
    p_venue_slug: venueSlug,
  });

  if (error) throw new Error(error.message);

  return data;
}

export async function closeLiveCapacitySession(actorEmail: string, venueSlug = DEFAULT_VENUE_SLUG) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('close_discotheque_capacity_session', {
    p_actor_email: actorEmail,
    p_venue_slug: venueSlug,
  });

  if (error) throw new Error(error.message);

  return data;
}

export async function adjustLiveCapacity(params: {
  actorEmail: string;
  delta: number;
  note?: string | null;
  venueSlug?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { actorEmail, delta, note, venueSlug = DEFAULT_VENUE_SLUG } = params;

  const { data, error } = await supabase.rpc('adjust_discotheque_capacity', {
    p_actor_email: actorEmail,
    p_delta: delta,
    p_note: note ?? null,
    p_venue_slug: venueSlug,
  });

  if (error) throw new Error(error.message);

  return data;
}
