import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { getAllowlistRoleFromRequest } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const allowlistInfo = await getAllowlistRoleFromRequest(authClient);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json(
      { error: 'Allowlist check failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted) {
    const forbidden = NextResponse.json(
      { error: 'Forbidden' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    const serverError = NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const rooms = (data ?? []).map((room) => ({
    id: room.id,
    name: room.name,
  }));

  const response = NextResponse.json({ rooms }, { headers: { 'Cache-Control': 'no-store' } });
  mergeResponseCookies(supabaseResponse, response);

  return response;
}
