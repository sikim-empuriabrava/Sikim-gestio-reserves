import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleFromRequest, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

const VALID_PRIORITIES = ['low', 'normal', 'high'] as const;
const VALID_DELETE_MODES = ['keep_all', 'delete_from_week'] as const;

type Priority = (typeof VALID_PRIORITIES)[number];
type DeleteMode = (typeof VALID_DELETE_MODES)[number];

function isValidPriority(value: unknown): value is Priority {
  return typeof value === 'string' && VALID_PRIORITIES.includes(value as Priority);
}

function isValidDeleteMode(value: unknown): value is DeleteMode {
  return typeof value === 'string' && VALID_DELETE_MODES.includes(value as DeleteMode);
}

function isValidDayOfWeek(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

function normalizeTitle(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDescription(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRoutinePackId(value: unknown) {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
}

function isValidDateString(value: unknown) {
  if (typeof value !== 'string') return false;
  const matches = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!matches) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function isMonday(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return date.getUTCDay() === 1;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const allowlistInfo = await getAllowlistRoleFromRequest(authClient);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const supabase = createSupabaseAdminClient();
  const { data: currentRoutine, error: fetchError } = await supabase
    .from('routines')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) {
    const serverError = NextResponse.json({ error: fetchError.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  if (!currentRoutine) {
    const notFound = NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    mergeResponseCookies(supabaseResponse, notFound);
    return notFound;
  }

  const body = await req.json().catch(() => null);

  const updates: Record<string, string | number | boolean | null> = {};

  if (body && Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = normalizeTitle(body.title);
    if (!title) {
      const invalidTitle = NextResponse.json({ error: 'Invalid title' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidTitle);
      return invalidTitle;
    }
    updates.title = title;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'description')) {
    updates.description = normalizeDescription(body.description);
  }

  const hasStartDay = body && Object.prototype.hasOwnProperty.call(body, 'start_day_of_week');
  const hasEndDay =
    (body && Object.prototype.hasOwnProperty.call(body, 'end_day_of_week')) ||
    (body && Object.prototype.hasOwnProperty.call(body, 'day_of_week'));

  const providedStart = hasStartDay ? Number(body.start_day_of_week) : undefined;
  const providedEnd = hasEndDay
    ? Number(body.end_day_of_week ?? body.day_of_week)
    : undefined;

  const nextStartDay =
    providedStart ??
    currentRoutine.start_day_of_week ??
    currentRoutine.end_day_of_week ??
    currentRoutine.day_of_week;
  const nextEndDay =
    providedEnd ?? currentRoutine.end_day_of_week ?? currentRoutine.day_of_week ?? nextStartDay;

  if (hasStartDay && !isValidDayOfWeek(nextStartDay)) {
    const invalidStartDay = NextResponse.json({ error: 'Invalid start_day_of_week' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidStartDay);
    return invalidStartDay;
  }

  if (hasEndDay && !isValidDayOfWeek(nextEndDay)) {
    const invalidEndDay = NextResponse.json({ error: 'Invalid end_day_of_week' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidEndDay);
    return invalidEndDay;
  }

  if (hasStartDay || hasEndDay) {
    if (!isValidDayOfWeek(nextStartDay) || !isValidDayOfWeek(nextEndDay) || nextStartDay > nextEndDay) {
      const invalidWindow = NextResponse.json(
        { error: 'start_day_of_week cannot be greater than end_day_of_week' },
        { status: 400 }
      );
      mergeResponseCookies(supabaseResponse, invalidWindow);
      return invalidWindow;
    }

    if (hasStartDay) {
      updates.start_day_of_week = nextStartDay;
    }

    if (hasEndDay) {
      updates.end_day_of_week = nextEndDay;
    }

    updates.day_of_week = nextEndDay;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'priority')) {
    if (!isValidPriority(body.priority)) {
      const invalidPriority = NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidPriority);
      return invalidPriority;
    }
    updates.priority = body.priority;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'is_active')) {
    if (typeof body.is_active !== 'boolean') {
      const invalidActive = NextResponse.json({ error: 'Invalid is_active' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidActive);
      return invalidActive;
    }
    updates.is_active = body.is_active;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'routine_pack_id')) {
    const routinePackId = normalizeRoutinePackId(body.routine_pack_id);
    if (routinePackId === undefined) {
      const invalidPack = NextResponse.json({ error: 'Invalid routine_pack_id' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidPack);
      return invalidPack;
    }
    updates.routine_pack_id = routinePackId;
  }

  if (Object.keys(updates).length === 0) {
    const missing = NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missing);
    return missing;
  }

  const { data, error } = await supabase
    .from('routines')
    .update(updates)
    .eq('id', params.id)
    .select()
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  if (!data) {
    const notFound = NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    mergeResponseCookies(supabaseResponse, notFound);
    return notFound;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const allowlistInfo = await getAllowlistRoleFromRequest(authClient);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = typeof body.mode === 'string' ? body.mode : 'keep_all';
  const cutoffRaw = body.cutoff_week_start;
  const cutoffWeekStart = typeof cutoffRaw === 'string' ? cutoffRaw : null;

  if (!isValidDeleteMode(mode)) {
    const invalidMode = NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidMode);
    return invalidMode;
  }

  if (mode === 'delete_from_week') {
    if (!cutoffWeekStart) {
      const invalidDate = NextResponse.json({ error: 'cutoff_week_start is required' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidDate);
      return invalidDate;
    }

    if (!isValidDateString(cutoffWeekStart)) {
      const invalidDate = NextResponse.json({ error: 'cutoff_week_start must be YYYY-MM-DD' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidDate);
      return invalidDate;
    }

    if (!isMonday(cutoffWeekStart)) {
      const notMonday = NextResponse.json({ error: 'cutoff_week_start debe ser lunes' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, notMonday);
      return notMonday;
    }
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('delete_routine_template', {
    p_routine_id: params.id,
    p_mode: mode,
    p_cutoff_week_start: mode === 'delete_from_week' ? cutoffWeekStart : null,
  });

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  if (!data) {
    const notFound = NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    mergeResponseCookies(supabaseResponse, notFound);
    return notFound;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
