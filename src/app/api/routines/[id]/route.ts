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

  if (body && Object.prototype.hasOwnProperty.call(body, 'day_of_week')) {
    const dayOfWeek = Number(body.day_of_week);
    if (!isValidDayOfWeek(dayOfWeek)) {
      const invalidDay = NextResponse.json({ error: 'Invalid day_of_week' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidDay);
      return invalidDay;
    }
    updates.day_of_week = dayOfWeek;
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

  if (Object.keys(updates).length === 0) {
    const missing = NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missing);
    return missing;
  }

  const supabase = createSupabaseAdminClient();
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
