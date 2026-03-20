import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { loadCheffingConsumerDishes } from '@/lib/cheffing/consumerQueries';
import {
  getConservativeMarginDiagnostics,
  getConsumerConservativeCostTotal,
  getConsumerLineCost,
} from '@/lib/cheffing/consumers';

import { CheffingConsumerList } from '@/app/(cheffing)/cheffing/components/CheffingConsumerList';

export default async function CheffingMenusPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [{ data: menus, error: menusError }, { data: items, error: itemsError }, { dishes }] = await Promise.all([
    supabase
      .from('cheffing_menus')
      .select('id, name, notes, price_per_person, is_active, created_at, updated_at')
      .order('name', { ascending: true }),
    supabase
      .from('cheffing_menu_items')
      .select('id, menu_id, dish_id, multiplier, sort_order, notes, created_at, updated_at')
      .order('sort_order', { ascending: true }),
    loadCheffingConsumerDishes(),
  ]);

  if (menusError || itemsError) {
    console.error('[cheffing/menus] Failed to load menus', menusError ?? itemsError);
  }

  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  const itemsByMenuId = new Map<string, typeof items>();
  (items ?? []).forEach((item) => {
    const list = itemsByMenuId.get(item.menu_id) ?? [];
    list.push(item);
    itemsByMenuId.set(item.menu_id, list);
  });

  const entries = (menus ?? []).map((menu) => {
    const menuItems = itemsByMenuId.get(menu.id) ?? [];
    const costDiagnostics = getConsumerConservativeCostTotal(
      menuItems.map((item) => ({
        lineName: dishById.get(item.dish_id)?.name ?? 'Línea sin plato/bebida',
        cost: getConsumerLineCost(dishById.get(item.dish_id)?.items_cost_total ?? null, item.multiplier),
      })),
    );
    const marginDiagnostics = getConservativeMarginDiagnostics({
      totalCost: costDiagnostics.total,
      price: menu.price_per_person,
      label: `el menú "${menu.name}"`,
    });

    return {
      ...menu,
      total_cost: costDiagnostics.total,
      total_margin: marginDiagnostics.margin,
      calculation_issue: costDiagnostics.blocking_reasons[0] ?? marginDiagnostics.blocking_reasons[0] ?? null,
    };
  });

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Menús</h2>
        <p className="text-sm text-slate-400">
          Los menús consumen platos/bebidas canónicos con multiplicador por persona.
        </p>
      </header>

      <CheffingConsumerList
        title="Menú"
        createHref="/cheffing/menus/new"
        detailBaseHref="/cheffing/menus"
        searchPlaceholder="Buscar menú por nombre"
        showFinancials
        entries={entries}
      />
    </section>
  );
}
