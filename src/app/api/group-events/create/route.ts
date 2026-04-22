import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest) {
  const supabaseResponse = NextResponse.next();

  const respond = (body: Record<string, unknown>, init?: Parameters<typeof NextResponse.json>[1]) => {
    const response = NextResponse.json(body, init);
    mergeResponseCookies(supabaseResponse, response);
    return response;
  };

  const supabaseAuth = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return respond({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    return respond({ error: 'Not allowed' }, { status: 403, headers: noStoreHeaders });
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    return respond({ error: 'Allowlist check failed' }, { status: 500, headers: noStoreHeaders });
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    return respond({ error: 'Forbidden' }, { status: 403, headers: noStoreHeaders });
  }

  try {
    const payload = (await req.json()) as Record<string, unknown>;

    if (!payload) {
      return respond({ error: 'Missing payload' }, { status: 400, headers: noStoreHeaders });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc('create_group_event_with_cheffing_offerings', {
      p_payload: payload,
    });

    if (error || !data) {
      const message = error?.message ?? 'Unable to create group event';
      const normalizedMessage = message.toLowerCase();
      const status =
        normalizedMessage.includes('missing') ||
        normalizedMessage.includes('invalid') ||
        normalizedMessage.includes('unknown') ||
        normalizedMessage.includes('inactive')
          ? 400
          : 500;
      return respond({ error: message }, { status, headers: noStoreHeaders });
    }

    return respond({ groupEventId: data }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[API] group-events/create', error);
    return respond(
      { error: 'Unexpected error while creating the reservation' },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
