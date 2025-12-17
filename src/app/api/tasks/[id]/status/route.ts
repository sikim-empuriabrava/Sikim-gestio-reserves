import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const VALID_STATUSES = ['open', 'in_progress', 'done'] as const;
type Status = (typeof VALID_STATUSES)[number];

function isValidStatus(value: unknown): value is Status {
  return typeof value === 'string' && VALID_STATUSES.includes(value as Status);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
  const status = body?.status;

  if (!isValidStatus(status)) {
    const invalidStatus = NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidStatus);
    return invalidStatus;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tasks')
    .update({ status })
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
