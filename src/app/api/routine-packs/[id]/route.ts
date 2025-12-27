import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const VALID_AREAS = ['maintenance', 'kitchen'] as const;
type Area = (typeof VALID_AREAS)[number];

function isValidArea(value: unknown): value is Area {
  return typeof value === 'string' && VALID_AREAS.includes(value as Area);
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

  const body = await req.json().catch(() => null);

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

  if (body && Object.prototype.hasOwnProperty.call(body, 'enabled')) {
    if (typeof body.enabled !== 'boolean') {
      const invalidEnabled = NextResponse.json({ error: 'Invalid enabled flag' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidEnabled);
      return invalidEnabled;
    }
    updates.enabled = body.enabled;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'auto_generate')) {
    if (typeof body.auto_generate !== 'boolean') {
      const invalidAuto = NextResponse.json({ error: 'Invalid auto_generate flag' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidAuto);
      return invalidAuto;
    }
    updates.auto_generate = body.auto_generate;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'area')) {
    if (body.area !== null && !isValidArea(body.area)) {
      const invalidArea = NextResponse.json({ error: 'Invalid area' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidArea);
      return invalidArea;
    }

    updates.area = body.area;
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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

  const supabase = createSupabaseAdminClient();

  const { count, error: countError } = await supabase
    .from('routines')
    .select('id', { count: 'exact', head: true })
    .eq('routine_pack_id', params.id);

  if (countError) {
    const serverError = NextResponse.json({ error: countError.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  if ((count ?? 0) > 0) {
    const conflict = NextResponse.json(
      { error: 'No se puede borrar el pack porque tiene rutinas asociadas' },
      { status: 409 }
    );
    mergeResponseCookies(supabaseResponse, conflict);
    return conflict;
  }

  const { data, error } = await supabase
    .from('routine_packs')
    .delete()
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

  const response = NextResponse.json(null, { status: 204 });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
