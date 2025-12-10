import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...payload } = body ?? {};

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...payload };

    // Campos que NUNCA debemos actualizar desde la API
    delete updateData.total_pax;
    delete updateData.totalPax;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Mantenemos updated_at siempre coherente
    updateData.updated_at = new Date().toISOString();

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('group_events')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Unexpected error while updating group event' },
      { status: 500 },
    );
  }
}
