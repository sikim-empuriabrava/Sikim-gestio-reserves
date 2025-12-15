import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  const rooms = (data ?? []).map((room) => ({
    id: room.id,
    name: room.name,
  }));

  const response = NextResponse.json({ rooms }, { headers: { 'Cache-Control': 'no-store' } });
  mergeResponseCookies(supabaseResponse, response);

  return response;
}
