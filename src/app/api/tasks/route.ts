import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

const VALID_AREAS = ['maintenance', 'kitchen'] as const;
const VALID_STATUSES = ['open', 'done'] as const;
const VALID_PRIORITIES = ['low', 'normal', 'high'] as const;

type Area = (typeof VALID_AREAS)[number];
type Status = (typeof VALID_STATUSES)[number];
type Priority = (typeof VALID_PRIORITIES)[number];
function isValidArea(value: unknown): value is Area {
  return typeof value === 'string' && VALID_AREAS.includes(value as Area);
}

function isValidDate(value: unknown) {
  if (typeof value !== 'string') return false;
  const matchesFormat = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!matchesFormat) return false;

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isValidStatus(value: unknown): value is Status {
  return typeof value === 'string' && VALID_STATUSES.includes(value as Status);
}

function isValidPriority(value: unknown): value is Priority {
  return typeof value === 'string' && VALID_PRIORITIES.includes(value as Priority);
}

function formatDescription(description: unknown) {
  return typeof description === 'string' && description.trim().length > 0 ? description.trim() : null;
}

export async function GET(req: NextRequest) {
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

  const email = user.email?.trim().toLowerCase();

  if (!email) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(email);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const area = req.nextUrl.searchParams.get('area');
  const status = req.nextUrl.searchParams.get('status');
  const dueDateFrom = req.nextUrl.searchParams.get('due_date_from');
  const dueDateTo = req.nextUrl.searchParams.get('due_date_to');
  const includeNoDueDate = req.nextUrl.searchParams.get('include_no_due_date') === 'true';

  if (!isAdmin(allowlistInfo.role) && area === 'maintenance' && !allowlistInfo.allowedUser?.can_mantenimiento) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  if (!isAdmin(allowlistInfo.role) && area === 'kitchen' && !allowlistInfo.allowedUser?.can_cocina) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  if (area && !isValidArea(area)) {
    const invalidArea = NextResponse.json({ error: 'Invalid area' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidArea);
    return invalidArea;
  }

  if (!area && !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  if (status && !isValidStatus(status)) {
    const invalidStatus = NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidStatus);
    return invalidStatus;
  }

  if ((dueDateFrom && !isValidDate(dueDateFrom)) || (dueDateTo && !isValidDate(dueDateTo))) {
    const invalidDates = NextResponse.json({ error: 'Invalid due date filter' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidDates);
    return invalidDates;
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

  if (area) {
    query = query.eq('area', area);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (dueDateFrom || dueDateTo) {
    const rangeConditions = [] as string[];

    if (dueDateFrom) {
      rangeConditions.push(`due_date.gte.${dueDateFrom}`);
    }

    if (dueDateTo) {
      rangeConditions.push(`due_date.lte.${dueDateTo}`);
    }

    if (includeNoDueDate) {
      const rangeCondition = rangeConditions.length ? `and(${rangeConditions.join(',')})` : '';
      const orConditions = ['due_date.is.null'];

      if (rangeCondition) {
        orConditions.push(rangeCondition);
      }

      query = query.or(orConditions.join(','));
    } else {
      if (dueDateFrom) {
        query = query.gte('due_date', dueDateFrom);
      }

      if (dueDateTo) {
        query = query.lte('due_date', dueDateTo);
      }
    }
  }

  const { data, error } = await query;

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  const sorted = [...(data ?? [])].sort((a, b) => {
    const aOverdue = Boolean(a.due_date && a.due_date < todayISO && a.status !== 'done');
    const bOverdue = Boolean(b.due_date && b.due_date < todayISO && b.status !== 'done');

    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
    }

    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }

    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;

    if (a.created_at && b.created_at && a.created_at !== b.created_at) {
      return b.created_at.localeCompare(a.created_at);
    }

    return 0;
  });

  const response = NextResponse.json(sorted);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}

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

  const email = user.email?.trim().toLowerCase();

  if (!email) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(email);
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

  const body = await req.json().catch(() => null);
  const area = body?.area;
  const title = body?.title;
  const description = formatDescription(body?.description);
  const priority = body?.priority ?? 'normal';
  const dueDate = body?.due_date ?? body?.dueDate ?? null;
  const status = body?.status ?? 'open';

  if (!isValidArea(area)) {
    const invalidArea = NextResponse.json({ error: 'Invalid area' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidArea);
    return invalidArea;
  }

  if (!title || typeof title !== 'string') {
    const invalidTitle = NextResponse.json({ error: 'Missing title' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidTitle);
    return invalidTitle;
  }

  if (!isValidPriority(priority)) {
    const invalidPriority = NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidPriority);
    return invalidPriority;
  }

  if (!isValidStatus(status)) {
    const invalidStatus = NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidStatus);
    return invalidStatus;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      area,
      title,
      description,
      priority,
      status,
      due_date: dueDate,
      created_by_email: email,
    })
    .select()
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
