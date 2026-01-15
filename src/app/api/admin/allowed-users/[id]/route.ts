import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

const VALID_ROLES = ['admin', 'staff', 'viewer'] as const;
type Role = (typeof VALID_ROLES)[number];

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && VALID_ROLES.includes(value as Role);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const allowlistInfo = await getAllowlistRoleForUserEmail(user.email);
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

  const body = await req.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (body?.display_name !== undefined) {
    updates.display_name =
      typeof body.display_name === 'string' ? body.display_name.trim() || null : null;
  }

  if (body?.role !== undefined) {
    if (!isValidRole(body.role)) {
      const invalidRole = NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidRole);
      return invalidRole;
    }
    updates.role = body.role;
  }

  if (body?.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  if (body?.can_reservas !== undefined) {
    updates.can_reservas = Boolean(body.can_reservas);
  }

  if (body?.can_mantenimiento !== undefined) {
    updates.can_mantenimiento = Boolean(body.can_mantenimiento);
  }

  if (body?.can_cocina !== undefined) {
    updates.can_cocina = Boolean(body.can_cocina);
  }

  if (Object.keys(updates).length === 0) {
    const missing = NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missing);
    return missing;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('app_allowed_users')
    .update(updates)
    .eq('id', params.id)
    .select()
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  if (!data) {
    const notFound = NextResponse.json({ error: 'User not found' }, { status: 404 });
    mergeResponseCookies(supabaseResponse, notFound);
    return notFound;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
