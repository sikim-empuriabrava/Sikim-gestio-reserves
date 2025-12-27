import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const VALID_AREAS = ['maintenance', 'kitchen'] as const;
type Area = (typeof VALID_AREAS)[number];

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

export async function GET() {
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
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const body = await req.json().catch(() => null);
  const name = normalizeName(body?.name);
  const description = normalizeDescription(body?.description);
  const enabled = typeof body?.enabled === 'boolean' ? body.enabled : true;
  const autoGenerate = typeof body?.auto_generate === 'boolean' ? body.auto_generate : false;
  const area = body?.area ?? null;

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

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('routine_packs')
    .insert({
      name,
      description,
      enabled,
      auto_generate: autoGenerate,
      area,
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
