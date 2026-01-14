import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleFromRequest, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

const VALID_AREAS = ['maintenance', 'kitchen'] as const;

type Area = (typeof VALID_AREAS)[number];

type RoutinePackPayload = {
  name?: unknown;
  description?: unknown;
  area?: unknown;
  enabled?: unknown;
  auto_generate?: unknown;
};

function isValidArea(value: unknown): value is Area {
  return typeof value === 'string' && VALID_AREAS.includes(value as Area);
}

function normalizeName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDescription(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (value === undefined) return undefined;
  return 'invalid';
}

export async function GET() {
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

  if (!allowlistInfo.allowlisted) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('routine_packs').select('*').order('name', { ascending: true });

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

  const body = (await req.json().catch(() => null)) as RoutinePackPayload | null;
  const name = normalizeName(body?.name);
  const description = normalizeDescription(body?.description);
  const area = body?.area ?? null;
  const enabled = parseOptionalBoolean(body?.enabled);
  const autoGenerate = parseOptionalBoolean(body?.auto_generate);

  if (!name) {
    const invalidName = NextResponse.json({ error: 'Missing name' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidName);
    return invalidName;
  }

  if (area !== null && !isValidArea(area)) {
    const invalidArea = NextResponse.json({ error: 'Invalid area' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidArea);
    return invalidArea;
  }

  if (enabled === 'invalid') {
    const invalidEnabled = NextResponse.json({ error: 'Invalid enabled' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidEnabled);
    return invalidEnabled;
  }

  if (autoGenerate === 'invalid') {
    const invalidAuto = NextResponse.json({ error: 'Invalid auto_generate' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidAuto);
    return invalidAuto;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('routine_packs')
    .insert({
      name,
      description,
      area,
      enabled: enabled ?? false,
      auto_generate: autoGenerate ?? false,
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
