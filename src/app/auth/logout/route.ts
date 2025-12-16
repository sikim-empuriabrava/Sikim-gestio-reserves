import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error al cerrar sesión en el servidor', error);
  }

  const response = NextResponse.redirect(new URL('/login', req.url));
  response.cookies.set('sb-access-token', '', { path: '/', expires: new Date(0) });
  response.cookies.set('sb-refresh-token', '', { path: '/', expires: new Date(0) });

  return response;
}
