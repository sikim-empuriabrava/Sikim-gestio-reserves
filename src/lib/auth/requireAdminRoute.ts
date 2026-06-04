import { NextResponse } from 'next/server';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

type RequireAdminRouteAccessResult =
  | {
      ok: true;
      supabaseResponse: NextResponse;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireAdminRouteAccess(): Promise<RequireAdminRouteAccessResult> {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return { ok: false, response: unauthorized };
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return { ok: false, response: notAllowed };
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return { ok: false, response: allowlistError };
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return { ok: false, response: forbidden };
  }

  return { ok: true, supabaseResponse };
}
