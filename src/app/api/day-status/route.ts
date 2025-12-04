import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Missing date param' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('day_status')
    .select(
      'event_date, validated, is_validated, notes_general, notes_kitchen, notes_maintenance, day_notes, cocina_notes, mantenimiento_notes, last_validated_at, last_validated_by, events_last_reviewed_at, last_edited_at'
    )
    .eq('event_date', date)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      event_date: date,
      validated: false,
      is_validated: false,
      notes_general: '',
      notes_kitchen: '',
      notes_maintenance: '',
      day_notes: '',
      cocina_notes: '',
      mantenimiento_notes: '',
    });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    eventDate,
    notesGeneral,
    notesKitchen,
    notesMaintenance,
    action,
  }: {
    eventDate?: string;
    notesGeneral?: string;
    notesKitchen?: string;
    notesMaintenance?: string;
    action?: 'save' | 'validate';
  } = body ?? {};

  if (!eventDate) {
    return NextResponse.json({ error: 'Missing eventDate' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    event_date: eventDate,
    notes_general: notesGeneral ?? '',
    notes_kitchen: notesKitchen ?? '',
    notes_maintenance: notesMaintenance ?? '',
    day_notes: notesGeneral ?? '',
    cocina_notes: notesKitchen ?? '',
    mantenimiento_notes: notesMaintenance ?? '',
    last_edited_at: now,
  };

  if (action === 'validate') {
    payload.validated = true;
    payload.is_validated = true;
    payload.last_validated_at = now;
    payload.last_validated_by = 'Carla';
    payload.events_last_reviewed_at = now;
  }

  const { data, error } = await supabase
    .from('day_status')
    .upsert(payload, { onConflict: 'event_date' })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
