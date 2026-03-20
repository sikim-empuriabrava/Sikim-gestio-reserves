import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { loadCheffingConsumerDishes } from '@/lib/cheffing/consumerQueries';
import type { CheffingMenu, CheffingMenuItem } from '@/lib/cheffing/types';
import { formatEditableMoney } from '@/lib/cheffing/money';

import { CheffingMenuEditor } from '@/app/(cheffing)/cheffing/components/CheffingMenuEditor';

export default async function CheffingMenuDetailPage({ params }: { params: { id: string } }) {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [{ data: menu }, { data: items }, { dishes }] = await Promise.all([
    supabase
      .from('cheffing_menus')
      .select('id, name, notes, price_per_person, is_active, created_at, updated_at')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('cheffing_menu_items')
      .select('id, menu_id, dish_id, section_kind, multiplier, sort_order, notes, created_at, updated_at')
      .eq('menu_id', params.id)
      .order('section_kind', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    loadCheffingConsumerDishes(),
  ]);

  if (!menu) {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
        <p className="text-sm text-slate-300">No se encontró el menú.</p>
        <Link href="/cheffing/menus" className="text-sm text-emerald-300 underline">
          Volver al listado
        </Link>
      </section>
    );
  }

  const typedMenu = menu as CheffingMenu;

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Menú · {typedMenu.name}</h2>
        <p className="text-sm text-slate-400">Editor por secciones con coste y margen por persona.</p>
      </header>

      <CheffingMenuEditor
        id={typedMenu.id}
        header={{
          name: typedMenu.name,
          notes: typedMenu.notes ?? '',
          is_active: typedMenu.is_active,
          price_per_person: formatEditableMoney(typedMenu.price_per_person),
        }}
        items={(items ?? []) as CheffingMenuItem[]}
        dishes={dishes}
      />
    </section>
  );
}
