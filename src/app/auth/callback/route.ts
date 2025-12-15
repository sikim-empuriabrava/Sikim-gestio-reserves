import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');
  const nextPath = nextParam && nextParam.startsWith('/') ? nextParam : '/reservas?view=week';
  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));

  if (code) {
    const supabase = createSupabaseRouteHandlerClient(response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth callback] Error exchanging code for session', error.message);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('auth')}`, requestUrl.origin));
    }
  }

  const finalResponse = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  mergeResponseCookies(response, finalResponse);

  return finalResponse;
}
