import { NextResponse } from 'next/server';

import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireCheffingAdminAccess() {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const respond = (body: Record<string, unknown>, init?: Parameters<typeof NextResponse.json>[1]) => {
    const response = NextResponse.json(body, init);
    mergeResponseCookies(supabaseResponse, response);
    return response;
  };

  if (!user) {
    return { response: respond({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    return { response: respond({ error: 'Not allowed' }, { status: 403 }) };
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    return { response: respond({ error: 'Allowlist check failed' }, { status: 500 }) };
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    return { response: respond({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { response: null, supabaseResponse };
}

export async function POST() {
  const access = await requireCheffingAdminAccess();
  if (access.response) {
    return access.response;
  }

  const response = NextResponse.json(
    { error: 'Not implemented yet (SumUp sync disabled)' },
    { status: 501 }
  );
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
