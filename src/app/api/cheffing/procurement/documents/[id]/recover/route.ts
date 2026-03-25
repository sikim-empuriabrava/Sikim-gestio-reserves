import { NextResponse } from 'next/server';

import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';

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

  if (current.status !== 'discarded') {
    const response = NextResponse.json({ error: 'Only discarded documents can be recovered' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const { error } = await supabase
    .from('cheffing_purchase_documents')
    .update({ status: 'draft', discarded_at: null })
    .eq('id', params.id);

  if (error) {
    const response = NextResponse.json({ error: 'Could not recover document' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
