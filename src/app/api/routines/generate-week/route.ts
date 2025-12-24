import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

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
  const weekStart = body?.week_start;

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

  const { data, error } = await supabase.rpc('generate_weekly_tasks', {
    p_week_start: weekStart,
    p_created_by_email: session.user.email,
  });

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const rpcResult = Array.isArray(data) ? data?.[0] : data;
  const created = rpcResult?.created ?? 0;
  const skipped = rpcResult?.skipped ?? 0;

  const response = NextResponse.json({ created, skipped });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
