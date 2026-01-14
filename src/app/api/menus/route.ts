import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { getAllowlistRoleForUserEmail } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const noStoreHeaders = { 'Cache-Control': 'no-store' };
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(user.email);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json(
      { error: 'Allowlist check failed' },
      { status: 500, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted) {
    const forbidden = NextResponse.json(
      { error: 'Forbidden' },
      { status: 403, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const supabase = createSupabaseAdminClient();

  const { data: menusData, error: menusError } = await supabase
    .from('menus')
    .select('id, code, display_name, price_eur')
    .order('display_name', { ascending: true });

  if (menusError) {
    const response = NextResponse.json(
      { error: menusError.message ?? 'Unknown error loading menus' },
      { status: 500, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ menus: menusData ?? [] }, { headers: noStoreHeaders });
  mergeResponseCookies(supabaseResponse, response);

  return response;
}
