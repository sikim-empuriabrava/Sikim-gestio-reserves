import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleFromRequest, isAdmin } from '@/lib/auth/requireRole';

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

  const allowlistInfo = await getAllowlistRoleFromRequest(authClient);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  try {
    const body = await req.json();
    const { id, ...payload } = body ?? {};

    if (!id) {
      const missingId = NextResponse.json({ error: 'Missing id' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, missingId);
      return missingId;
    }

    const updateData: Record<string, unknown> = { ...payload };

    // Campos que NUNCA debemos actualizar desde la API
    delete updateData.total_pax;
    delete updateData.totalPax;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Mantenemos updated_at siempre coherente
    updateData.updated_at = new Date().toISOString();

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('group_events')
      .update(updateData)
      .eq('id', id);

    if (error) {
      const serverError = NextResponse.json({ error: error.message }, { status: 500 });
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
