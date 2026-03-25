import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase
    .from('cheffing_purchase_documents')
    .select('status')
    .eq('id', params.id)
    .maybeSingle();

  if (currentError || !current) {
    const response = NextResponse.json({ error: 'Document not found' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (current.status !== 'draft') {
    const response = NextResponse.json({ error: 'Only draft documents can be discarded' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const { error } = await supabase
    .from('cheffing_purchase_documents')
    .update({ status: 'discarded', discarded_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) {
    const response = NextResponse.json({ error: 'Could not discard document' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
