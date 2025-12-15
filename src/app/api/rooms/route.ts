import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  const rooms = (data ?? []).map((room) => ({
    id: room.id,
    name: room.name,
  }));

  return NextResponse.json({ rooms }, { headers: { 'Cache-Control': 'no-store' } });
}
