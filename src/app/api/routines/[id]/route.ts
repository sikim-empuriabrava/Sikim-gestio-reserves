import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const VALID_PRIORITIES = ['low', 'normal', 'high'] as const;

type Priority = (typeof VALID_PRIORITIES)[number];

function isValidPriority(value: unknown): value is Priority {
  return typeof value === 'string' && VALID_PRIORITIES.includes(value as Priority);
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const supabase = createSupabaseAdminClient();

  const { count, error: countError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('routine_id', params.id);

  if (countError) {
    const serverError = NextResponse.json({ error: countError.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const { error: unlinkError } = await supabase
    .from('tasks')
    .update({ routine_id: null, routine_week_start: null })
    .eq('routine_id', params.id);

  if (unlinkError) {
    const serverError = NextResponse.json({ error: unlinkError.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const { data, error } = await supabase
    .from('routines')
    .delete()
    .eq('id', params.id)
    .select('id')
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

  const response = NextResponse.json({ deleted: true, unlinked_tasks: count ?? 0 });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
