import { NextResponse } from 'next/server';

import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export type CheffingRouteAccess = {
  supabaseResponse: NextResponse;
  response?: NextResponse;
  role?: string | null;
  canCheffing?: boolean;
  canMantenimiento?: boolean;
  isAdmin?: boolean;
};

export async function requireCheffingRouteAccess(options?: { allowMantenimiento?: boolean }): Promise<CheffingRouteAccess> {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return { supabaseResponse, response: unauthorized };
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return { supabaseResponse, response: notAllowed };
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return { supabaseResponse, response: allowlistError };
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return { supabaseResponse, response: forbidden };
  }

  const isAdminUser = isAdmin(allowlistInfo.role);
  const canCheffing = Boolean(allowlistInfo.allowedUser?.can_cheffing);
  const canMantenimiento = Boolean(allowlistInfo.allowedUser?.can_mantenimiento);
  const canAccessCheffingRoute = Boolean(isAdminUser || canCheffing || (options?.allowMantenimiento && canMantenimiento));

  if (!canAccessCheffingRoute) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return { supabaseResponse, response: forbidden };
  }

  return {
    supabaseResponse,
    role: allowlistInfo.role,
    canCheffing,
    canMantenimiento,
    isAdmin: isAdminUser,
  };
}
