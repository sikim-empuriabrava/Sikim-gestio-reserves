import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

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

function addDaysUTC(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDescriptionWithTags(description: string | null, routineId: string, weekStart: string) {
  const tags = [`#routine:${routineId}`, `#week:${weekStart}`];
  const base = description?.trim();
  return base && base.length > 0 ? `${base}\n\n${tags.join('\n')}` : tags.join('\n');
}

export async function POST(req: NextRequest) {
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
  const weekStart = body?.week_start;

  if (!isValidDateString(weekStart)) {
    const invalidDate = NextResponse.json({ error: 'week_start must be YYYY-MM-DD' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidDate);
    return invalidDate;
  }

  if (!isMonday(weekStart)) {
    const notMonday = NextResponse.json({ error: 'week_start debe ser lunes' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, notMonday);
    return notMonday;
  }

  const supabase = createSupabaseAdminClient();

  const { data: routines, error } = await supabase
    .from('routines')
    .select('*')
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  let created = 0;
  let skipped = 0;

  for (const routine of routines ?? []) {
    const tagRoutine = `#routine:${routine.id}`;
    const tagWeek = `#week:${weekStart}`;

    const { data: existing, error: existingError } = await supabase
      .from('tasks')
      .select('id')
      .eq('area', routine.area)
      .ilike('description', `%${tagRoutine}%`)
      .ilike('description', `%${tagWeek}%`)
      .limit(1);

    if (existingError) {
      const serverError = NextResponse.json({ error: existingError.message }, { status: 500 });
      mergeResponseCookies(supabaseResponse, serverError);
      return serverError;
    }

    if (existing && existing.length > 0) {
      skipped += 1;
      continue;
    }

    const dueDate = addDaysUTC(weekStart, (routine.day_of_week ?? 1) - 1);
    const description = buildDescriptionWithTags(routine.description, routine.id, weekStart);

    const { error: insertError } = await supabase.from('tasks').insert({
      area: routine.area,
      title: routine.title,
      description,
      priority: routine.priority,
      status: 'open',
      due_date: dueDate,
      created_by_email: session.user.email,
    });

    if (insertError) {
      const serverError = NextResponse.json({ error: insertError.message }, { status: 500 });
      mergeResponseCookies(supabaseResponse, serverError);
      return serverError;
    }

    created += 1;
  }

  const response = NextResponse.json({ created, skipped });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
