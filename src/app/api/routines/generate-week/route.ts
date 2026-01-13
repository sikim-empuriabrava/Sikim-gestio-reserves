import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleFromRequest, isAdmin } from '@/lib/auth/requireRole';

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

function isValidUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  const body = await req.json().catch(() => null);
  const weekStart = body?.week_start;
  const packId = body?.pack_id;

  if (!isValidDateString(weekStart)) {
    const invalidDate = NextResponse.json({ error: 'week_start must be YYYY-MM-DD' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidDate);
    return invalidDate;
  }

  if (!isMonday(weekStart)) {
    const notMonday = NextResponse.json({ error: 'week_start debe ser lunes' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, notMonday);
    return notMonday;
  }

  const supabase = createSupabaseAdminClient();

  let data;
  let error;
  let scope: 'all' | 'pack' = 'all';

  if (packId !== undefined) {
    if (packId !== 'none' && !isValidUuid(packId)) {
      const invalidPack = NextResponse.json({ error: 'pack_id debe ser UUID o "none"' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidPack);
      return invalidPack;
    }

    scope = 'pack';
    const { data: rpcData, error: rpcError } = await supabase.rpc('generate_weekly_tasks_for_pack', {
      p_week_start: weekStart,
      p_pack_id: packId === 'none' ? null : packId,
      p_created_by_email: user.email,
    });
    data = rpcData;
    error = rpcError;
  } else {
    const { data: rpcData, error: rpcError } = await supabase.rpc('generate_weekly_tasks', {
      p_week_start: weekStart,
      p_created_by_email: user.email,
    });
    data = rpcData;
    error = rpcError;
  }

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const rpcResult = Array.isArray(data) ? data?.[0] : data;
  const created = Number(rpcResult?.created ?? 0);
  const skipped = Number(rpcResult?.skipped ?? 0);

  const response = NextResponse.json({ created, skipped, scope });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
