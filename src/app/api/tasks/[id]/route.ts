import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleFromRequest, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

const VALID_STATUSES = ['open', 'in_progress', 'done'] as const;
const VALID_PRIORITIES = ['low', 'normal', 'high'] as const;

type Status = (typeof VALID_STATUSES)[number];
type Priority = (typeof VALID_PRIORITIES)[number];

function isValidStatus(value: unknown): value is Status {
  return typeof value === 'string' && VALID_STATUSES.includes(value as Status);
}

function isValidPriority(value: unknown): value is Priority {
  return typeof value === 'string' && VALID_PRIORITIES.includes(value as Priority);
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

  const body = await req.json().catch(() => null);
  const status = body?.status as Status | undefined;
  const priority = body?.priority as Priority | undefined;

  if (!status && !priority) {
    const missing = NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missing);
    return missing;
  }

  if (status && !isValidStatus(status)) {
    const invalidStatus = NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidStatus);
    return invalidStatus;
  }

  if (priority && !isValidPriority(priority)) {
    const invalidPriority = NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidPriority);
    return invalidPriority;
  }

  const updates: Record<string, string> = {};

  if (status) {
    updates.status = status;
  }

  if (priority) {
    updates.priority = priority;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tasks')
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
    const notFound = NextResponse.json({ error: 'Task not found' }, { status: 404 });
    mergeResponseCookies(supabaseResponse, notFound);
    return notFound;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
