import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseAdminClient();

  const [{ data: menusData, error: menusError }, { data: secondsData, error: secondsError }] =
    await Promise.all([
      supabase
        .from('menus')
        .select('id, code, display_name, price_eur, starters_text, dessert_text, drinks_text, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('menu_second_courses')
        .select('id, menu_id, code, name, description_kitchen, needs_doneness_points, sort_order'),
    ]);

  if (menusError || secondsError) {
    const message = menusError?.message ?? secondsError?.message ?? 'Unknown error loading menus';
    return NextResponse.json({ error: message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  const menus = (menusData ?? []).map((menu) => {
    const segundos = (secondsData ?? [])
      .filter((second) => second.menu_id === menu.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return {
      ...menu,
      segundos: segundos.map((s) => ({
        id: s.code,
        code: s.code,
        nombre: s.name,
        descripcion: s.description_kitchen,
        needsDonenessPoints: s.needs_doneness_points,
      })),
    };
  });

  return NextResponse.json({ menus }, { headers: { 'Cache-Control': 'no-store' } });
}
