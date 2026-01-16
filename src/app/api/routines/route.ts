import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

const VALID_AREAS = ['maintenance', 'kitchen'] as const;
const VALID_PRIORITIES = ['low', 'normal', 'high'] as const;

type Area = (typeof VALID_AREAS)[number];
type Priority = (typeof VALID_PRIORITIES)[number];

function isValidArea(value: unknown): value is Area {
  return typeof value === 'string' && VALID_AREAS.includes(value as Area);
}

function isValidPriority(value: unknown): value is Priority {
  return typeof value === 'string' && VALID_PRIORITIES.includes(value as Priority);
}

function isValidDayOfWeek(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

function parseIsActiveQuery(value: string | null): boolean | null | 'invalid' {
  if (value === null) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return 'invalid';
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

export async function GET(req: NextRequest) {
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

  const email = user.email?.trim().toLowerCase();

  if (!email) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(email);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const area = req.nextUrl.searchParams.get('area');
  const isActiveParam = req.nextUrl.searchParams.get('is_active');
  const packIdParam = req.nextUrl.searchParams.get('pack_id');

  if (area && !isValidArea(area)) {
    const invalidArea = NextResponse.json({ error: 'Invalid area' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidArea);
    return invalidArea;
  }

  const isActiveFilter = parseIsActiveQuery(isActiveParam);
  const packFilter =
    packIdParam === null || packIdParam === undefined
      ? undefined
      : packIdParam === 'none' || packIdParam === 'null' || packIdParam === ''
      ? null
      : packIdParam;

  if (isActiveFilter === 'invalid') {
    const invalidActive = NextResponse.json({ error: 'Invalid is_active value' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidActive);
    return invalidActive;
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase.from('routines').select('*').order('day_of_week', { ascending: true }).order('title', { ascending: true });

  if (area) {
    query = query.eq('area', area);
  }

  if (isActiveFilter !== null) {
    query = query.eq('is_active', isActiveFilter);
  }

  if (packFilter !== undefined) {
    query = packFilter === null ? query.is('routine_pack_id', null) : query.eq('routine_pack_id', packFilter);
  }

  const { data, error } = await query;

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json(data ?? []);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}

export async function POST(req: NextRequest) {
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

  const email = user.email?.trim().toLowerCase();

  if (!email) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(email);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const body = await req.json().catch(() => null);
  const area = body?.area;
  const title = normalizeTitle(body?.title);
  const description = normalizeDescription(body?.description);
  const startDayOfWeek = body?.start_day_of_week !== undefined ? Number(body.start_day_of_week) : undefined;
  const endDayOfWeek =
    body?.end_day_of_week !== undefined ? Number(body.end_day_of_week) : Number(body?.day_of_week);
  const dayOfWeek = Number(body?.day_of_week);
  const priority = (body?.priority as Priority | undefined) ?? 'normal';
  const isActive = typeof body?.is_active === 'boolean' ? body.is_active : true;
  const routinePackId = normalizeRoutinePackId(body?.routine_pack_id ?? null);

  if (!isValidArea(area)) {
    const invalidArea = NextResponse.json({ error: 'Invalid area' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidArea);
    return invalidArea;
  }

  if (!title) {
    const invalidTitle = NextResponse.json({ error: 'Missing title' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidTitle);
    return invalidTitle;
  }

  const finalEndDay = endDayOfWeek ?? dayOfWeek ?? startDayOfWeek;
  const finalStartDay = startDayOfWeek ?? dayOfWeek ?? finalEndDay;

  if (!isValidDayOfWeek(finalStartDay)) {
    const invalidStartDay = NextResponse.json({ error: 'Invalid start_day_of_week' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidStartDay);
    return invalidStartDay;
  }

  if (!isValidDayOfWeek(finalEndDay)) {
    const invalidDay = NextResponse.json({ error: 'Invalid end_day_of_week' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidDay);
    return invalidDay;
  }

  if (finalStartDay > finalEndDay) {
    const invalidWindow = NextResponse.json(
      { error: 'start_day_of_week cannot be greater than end_day_of_week' },
      { status: 400 }
    );
    mergeResponseCookies(supabaseResponse, invalidWindow);
    return invalidWindow;
  }

  if (!isValidPriority(priority)) {
    const invalidPriority = NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidPriority);
    return invalidPriority;
  }

  if (routinePackId === undefined) {
    const invalidPack = NextResponse.json({ error: 'Invalid routine_pack_id' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidPack);
    return invalidPack;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('routines')
    .insert({
      area,
      title,
      description,
      start_day_of_week: finalStartDay,
      end_day_of_week: finalEndDay,
      day_of_week: finalEndDay,
      priority,
      is_active: isActive,
      routine_pack_id: routinePackId ?? null,
    })
    .select()
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
