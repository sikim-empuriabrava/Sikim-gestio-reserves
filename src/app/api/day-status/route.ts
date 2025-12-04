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
    .select('event_date, is_validated, day_notes, cocina_notes, mantenimiento_notes, last_validated_at')
    .eq('event_date', date)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      event_date: date,
      is_validated: false,
      day_notes: '',
      cocina_notes: '',
      mantenimiento_notes: '',
    });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { eventDate, day_notes } = body ?? {};

  if (!eventDate) {
    return NextResponse.json({ error: 'Missing eventDate' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('day_status')
    .upsert(
      {
        event_date: eventDate,
        day_notes,
        is_validated: true,
        last_validated_at: new Date().toISOString(),
      },
      { onConflict: 'event_date' }
    )
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
