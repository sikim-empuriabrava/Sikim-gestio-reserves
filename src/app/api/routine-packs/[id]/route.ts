import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleFromRequest, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

const VALID_AREAS = ['maintenance', 'kitchen'] as const;
const VALID_DELETE_MODES = ['keep_all', 'delete_from_week'] as const;

type Area = (typeof VALID_AREAS)[number];
type DeleteMode = (typeof VALID_DELETE_MODES)[number];

type RoutinePackPatchPayload = {
  name?: unknown;
  description?: unknown;
  area?: unknown;
  enabled?: unknown;
  auto_generate?: unknown;
};

function isValidArea(value: unknown): value is Area {
  return typeof value === 'string' && VALID_AREAS.includes(value as Area);
}

function isValidDeleteMode(value: unknown): value is DeleteMode {
  return typeof value === 'string' && VALID_DELETE_MODES.includes(value as DeleteMode);
}

function normalizeName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDescription(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (value === undefined) return undefined;
  return 'invalid';
}

function isValidDateString(value: unknown) {
  if (typeof value !== 'string') return false;
  const matches = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!matches) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function isMonday(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return date.getUTCDay() === 1;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const { role } = await getAllowlistRoleFromRequest(authClient);
  if (!isAdmin(role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const body = (await req.json().catch(() => null)) as RoutinePackPatchPayload | null;
  const updates: Record<string, string | boolean | null> = {};

  if (body && Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = normalizeName(body.name);
    if (!name) {
      const invalidName = NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidName);
      return invalidName;
    }
    updates.name = name;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'description')) {
    updates.description = normalizeDescription(body.description);
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'area')) {
    const area = body.area ?? null;
    if (area !== null && !isValidArea(area)) {
      const invalidArea = NextResponse.json({ error: 'Invalid area' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidArea);
      return invalidArea;
    }
    updates.area = area;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'enabled')) {
    const enabled = parseOptionalBoolean(body.enabled);
    if (enabled === 'invalid') {
      const invalidEnabled = NextResponse.json({ error: 'Invalid enabled' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidEnabled);
      return invalidEnabled;
    }
    updates.enabled = enabled ?? false;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'auto_generate')) {
    const autoGenerate = parseOptionalBoolean(body.auto_generate);
    if (autoGenerate === 'invalid') {
      const invalidAuto = NextResponse.json({ error: 'Invalid auto_generate' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidAuto);
      return invalidAuto;
    }
    updates.auto_generate = autoGenerate ?? false;
  }

  if (Object.keys(updates).length === 0) {
    const missing = NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missing);
    return missing;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('routine_packs')
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
    const notFound = NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    mergeResponseCookies(supabaseResponse, notFound);
    return notFound;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const { role } = await getAllowlistRoleFromRequest(authClient);
  if (!isAdmin(role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = typeof body.mode === 'string' ? body.mode : 'keep_all';
  const cutoffRaw = body.cutoff_week_start;
  const cutoffWeekStart = typeof cutoffRaw === 'string' ? cutoffRaw : null;

  if (!isValidDeleteMode(mode)) {
    const invalidMode = NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidMode);
    return invalidMode;
  }

  if (mode === 'delete_from_week') {
    if (!cutoffWeekStart) {
      const invalidDate = NextResponse.json({ error: 'cutoff_week_start is required' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidDate);
      return invalidDate;
    }

    if (!isValidDateString(cutoffWeekStart)) {
      const invalidDate = NextResponse.json({ error: 'cutoff_week_start must be YYYY-MM-DD' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidDate);
      return invalidDate;
    }

    if (!isMonday(cutoffWeekStart)) {
      const notMonday = NextResponse.json({ error: 'cutoff_week_start debe ser lunes' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, notMonday);
      return notMonday;
    }
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('delete_routine_pack', {
    p_pack_id: params.id,
    p_mode: mode,
    p_cutoff_week_start: mode === 'delete_from_week' ? cutoffWeekStart : null,
  });

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  if (!data) {
    const notFound = NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    mergeResponseCookies(supabaseResponse, notFound);
    return notFound;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
