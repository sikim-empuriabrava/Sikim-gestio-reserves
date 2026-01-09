import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const noStoreHeaders = { 'Cache-Control': 'no-store' };
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
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
