import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import {
  getConservativeMarginDiagnostics,
  getConsumerLineCost,
} from '@/lib/cheffing/consumers';
import { loadCheffingConsumerDishes } from '@/lib/cheffing/consumerQueries';
import { getMenuConservativeCostDiagnostics, getNetPriceFromGross } from '@/lib/cheffing/menuEconomics';
import { normalizeMenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';

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
      .select('id, menu_id, dish_id, section_kind, multiplier, sort_order, notes, created_at, updated_at')
      .order('sort_order', { ascending: true }),
    loadCheffingConsumerDishes(),
  ]);

  if (menusError || itemsError) {
    console.error('[cheffing/menus] Failed to load menus', menusError ?? itemsError);
  }

  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  const vatRate = normalizeMenuEngineeringVatRate(undefined);
  const itemsByMenuId = new Map<string, typeof items>();
  (items ?? []).forEach((item) => {
    const list = itemsByMenuId.get(item.menu_id) ?? [];
    list.push(item);
    itemsByMenuId.set(item.menu_id, list);
  });

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

  const entries = (menus ?? []).map((menu) => {
    const menuItems = itemsByMenuId.get(menu.id) ?? [];
    const costDiagnostics = getMenuConservativeCostDiagnostics(
      menuItems.map((item) => ({
        section_kind: (item.section_kind ?? 'starter') as 'starter' | 'main' | 'drink' | 'dessert',
        lineName: dishById.get(item.dish_id)?.name ?? 'Línea sin plato/bebida',
        cost: getConsumerLineCost(dishById.get(item.dish_id)?.items_cost_total ?? null, item.multiplier),
      })),
    );
    const netPrice = getNetPriceFromGross(menu.price_per_person, vatRate);
    const marginDiagnostics = getConservativeMarginDiagnostics({
      totalCost: costDiagnostics.total,
      price: netPrice,
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
        <p className="text-sm text-slate-400">Consumidor por persona con coste total y margen conservador.</p>
      </header>

      <div className="flex items-center justify-end">
        <Link
          href="/cheffing/menus/new"
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
        >
          Nuevo menú
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[980px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Menú</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Coste total</th>
              <th className="px-4 py-3">Precio persona</th>
              <th className="px-4 py-3">Margen persona</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No hay menús.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-800/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/cheffing/menus/${entry.id}`}
                      className="font-semibold text-white underline-offset-2 transition hover:text-emerald-200 hover:underline"
                    >
                      {entry.name}
                    </Link>
                    {entry.notes ? <p className="text-xs text-slate-500">{entry.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3">{entry.is_active ? 'Activo' : 'Inactivo'}</td>
                  <td className="px-4 py-3">
                    <p>{formatCurrency(entry.total_cost)}</p>
                    {entry.calculation_issue ? <p className="text-xs text-amber-300">{entry.calculation_issue}</p> : null}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(entry.price_per_person)}</td>
                  <td className="px-4 py-3">{formatCurrency(entry.total_margin)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/cheffing/menus/${entry.id}`}
                      className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
