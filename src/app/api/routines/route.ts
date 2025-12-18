import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

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

export async function GET(req: NextRequest) {
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

  const area = req.nextUrl.searchParams.get('area');
  const isActiveParam = req.nextUrl.searchParams.get('is_active');

  if (area && !isValidArea(area)) {
    const invalidArea = NextResponse.json({ error: 'Invalid area' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidArea);
    return invalidArea;
  }

  const isActiveFilter = parseIsActiveQuery(isActiveParam);

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
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const body = await req.json().catch(() => null);
  const area = body?.area;
  const title = normalizeTitle(body?.title);
  const description = normalizeDescription(body?.description);
  const dayOfWeek = Number(body?.day_of_week);
  const priority = (body?.priority as Priority | undefined) ?? 'normal';
  const isActive = typeof body?.is_active === 'boolean' ? body.is_active : true;

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

  if (!isValidDayOfWeek(dayOfWeek)) {
    const invalidDay = NextResponse.json({ error: 'Invalid day_of_week' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidDay);
    return invalidDay;
  }

  if (!isValidPriority(priority)) {
    const invalidPriority = NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidPriority);
    return invalidPriority;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('routines')
    .insert({
      area,
      title,
      description,
      day_of_week: dayOfWeek,
      priority,
      is_active: isActive,
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
