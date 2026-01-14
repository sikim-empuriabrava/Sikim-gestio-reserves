import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseResponse = NextResponse.next();
  const supabase = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(user.email);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ ok: false, error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted) {
    const forbidden = NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const email = user.email?.toLowerCase() ?? null;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: allowedUser } = await supabaseAdmin
    .from('app_allowed_users')
    .select('id,email,is_active,role')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
    normalizedEmail: email,
    allowlisted: !!allowedUser,
    allowlistRow: allowedUser ?? null,
  });

  mergeResponseCookies(supabaseResponse, response);

  return response;
}
