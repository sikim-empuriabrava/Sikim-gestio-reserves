import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabaseRouteHandlerClient';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/reservas?view=week';
  const response = NextResponse.redirect(new URL(next, requestUrl.origin));

  if (code) {
    const supabase = createSupabaseRouteHandlerClient(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth callback] Error exchanging code for session', error.message);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('auth')}`, requestUrl.origin));
    }
  }

  return response;
}
