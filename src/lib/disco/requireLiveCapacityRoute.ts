import { NextResponse } from 'next/server';

import { canManageLiveCapacity, canViewLiveCapacity, getAllowlistRoleForUserEmail } from '@/lib/auth/requireRole';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

export type LiveCapacityRouteAccess = {
  supabaseResponse: NextResponse;
  response?: NextResponse;
  requesterEmail?: string;
  canManage?: boolean;
};

export async function requireLiveCapacityRouteAccess(options?: {
  requireManage?: boolean;
}): Promise<LiveCapacityRouteAccess> {
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

  const canView = canViewLiveCapacity(allowlistInfo.role, allowlistInfo.allowedUser);
  const canManage = canManageLiveCapacity(allowlistInfo.role, allowlistInfo.allowedUser);
  const forbidden = options?.requireManage ? !canManage : !canView;

  if (forbidden) {
    const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbiddenResponse);
    return { supabaseResponse, response: forbiddenResponse };
  }

  return { supabaseResponse, requesterEmail, canManage };
}
