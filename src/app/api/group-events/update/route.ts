import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, ...payload } = body ?? {};

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const updateData = { ...payload };
  delete updateData.total_pax;
  delete updateData.totalPax;
  delete updateData.created_at;
  delete updateData.updated_at;

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from('group_events').update(updateData).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
