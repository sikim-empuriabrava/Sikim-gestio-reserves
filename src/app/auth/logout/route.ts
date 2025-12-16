import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const supabase = createSupabaseRouteHandlerClient(supabaseResponse);

  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error al cerrar sesión en el servidor', error);
  }

  const response = NextResponse.redirect(
    new URL(`/login?next=${encodeURIComponent('/reservas?view=week')}`, req.url),
  );
  mergeResponseCookies(supabaseResponse, response);

  return response;
}
