import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (!body?.id) {
      const missingId = NextResponse.json({ error: 'Missing id' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, missingId);
      return missingId;
    }

    const sanitizedBody = { ...body };
    delete sanitizedBody.total_pax;
    delete sanitizedBody.totalPax;
    delete sanitizedBody.created_at;
    delete sanitizedBody.updated_at;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc('update_group_event_with_cheffing_offerings', {
      p_payload: sanitizedBody,
    });

    if (error || !data) {
      const message = error?.message ?? 'Unable to update group event';
      const normalizedMessage = message.toLowerCase();
      const status =
        normalizedMessage.includes('invalid') ||
        normalizedMessage.includes('missing') ||
        normalizedMessage.includes('unknown') ||
        normalizedMessage.includes('inactive')
          ? 400
          : 500;
      const serverError = NextResponse.json({ error: message }, { status });
      mergeResponseCookies(supabaseResponse, serverError);
      return serverError;
    }

    const success = NextResponse.json({ success: true });
    mergeResponseCookies(supabaseResponse, success);
    return success;
  } catch (e) {
    console.error(e);
    const unexpected = NextResponse.json(
      { error: 'Unexpected error while updating group event' },
      { status: 500 },
    );
    mergeResponseCookies(supabaseResponse, unexpected);
    return unexpected;
  }
}
