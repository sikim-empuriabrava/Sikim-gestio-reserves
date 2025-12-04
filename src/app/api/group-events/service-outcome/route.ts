import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { groupEventId, serviceOutcome, serviceOutcomeNotes } = body ?? {};

  if (!groupEventId) {
    return NextResponse.json({ error: 'Missing groupEventId' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('group_events')
    .update({
      service_outcome: serviceOutcome,
      service_outcome_notes: serviceOutcomeNotes ?? null,
      updated_at: now,
    })
    .eq('id', groupEventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
