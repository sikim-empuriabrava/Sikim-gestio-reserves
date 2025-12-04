import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    id,
    name,
    event_date,
    entry_time,
    adults,
    children,
    total_pax,
    has_private_dining_room,
    has_private_party,
    second_course_type,
    menu_text,
    allergens_and_diets,
    extras,
    setup_notes,
    invoice_data,
    deposit_amount,
    deposit_status,
    status,
  } = body ?? {};

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('group_events')
    .update({
      name,
      event_date,
      entry_time,
      adults,
      children,
      total_pax,
      has_private_dining_room,
      has_private_party,
      second_course_type,
      menu_text,
      allergens_and_diets,
      extras,
      setup_notes,
      invoice_data,
      deposit_amount,
      deposit_status,
      status,
      updated_at: now,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
