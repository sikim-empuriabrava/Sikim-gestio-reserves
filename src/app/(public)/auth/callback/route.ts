import { NextRequest, NextResponse } from 'next/server';
import { getAllowlistRoleForUserEmail, getDefaultLandingPath, type AllowedUser } from '@/lib/auth/requireRole';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

const DEFAULT_NEXT = '/';
const LIVE_CAPACITY_PATH = '/disco/aforo-en-directo';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');
  const requestedNextPath = normalizeNextPath(nextParam);
  const response = NextResponse.redirect(new URL(requestedNextPath, requestUrl.origin));

  if (code) {
    const supabase = createSupabaseRouteHandlerClient(response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth callback] Error exchanging code for session', error.message);
      const authErrorResponse = NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('auth')}`, requestUrl.origin),
      );
      applyNoStoreHeaders(authErrorResponse);
      return authErrorResponse;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const requesterEmail = user?.email?.trim().toLowerCase();
    const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

    if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
      await supabase.auth.signOut();
      const notAllowedResponse = NextResponse.redirect(
        new URL('/login?error=not_allowed', requestUrl.origin),
      );
      mergeResponseCookies(response, notAllowedResponse);
      applyNoStoreHeaders(notAllowedResponse);
      return notAllowedResponse;
    }

    const finalPath = resolvePostLoginPath(requestedNextPath, allowlistInfo.role, allowlistInfo.allowedUser);
    const finalResponse = NextResponse.redirect(new URL(finalPath, requestUrl.origin));
    mergeResponseCookies(response, finalResponse);
    applyNoStoreHeaders(finalResponse);

    return finalResponse;
  }

  const finalResponse = NextResponse.redirect(new URL(requestedNextPath, requestUrl.origin));
  mergeResponseCookies(response, finalResponse);
  applyNoStoreHeaders(finalResponse);

  return finalResponse;
}

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_NEXT;
  }

  if (value.startsWith('/auth/callback') || value.startsWith('/login')) {
    return DEFAULT_NEXT;
  }

  return value;
}

function resolvePostLoginPath(requestedPath: string, role: string | null, allowedUser: AllowedUser) {
  if (isLiveCapacityOnlyUser(role, allowedUser)) {
    return LIVE_CAPACITY_PATH;
  }

  return requestedPath === '/' ? getDefaultLandingPath(allowedUser) : requestedPath;
}

function isLiveCapacityOnlyUser(role: string | null, allowedUser: AllowedUser) {
  if (role === 'admin') {
    return false;
  }

  const hasLiveCapacity = Boolean(allowedUser.view_live_capacity || allowedUser.manage_live_capacity);
  const hasOtherModule = Boolean(
    allowedUser.can_reservas ||
      allowedUser.can_cocina ||
      allowedUser.can_mantenimiento ||
      allowedUser.can_cheffing,
  );

  return hasLiveCapacity && !hasOtherModule;
}

function applyNoStoreHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
}
