import Link from 'next/link';
import { EyeIcon, PlusIcon } from '@heroicons/react/24/outline';

import { DataTableShell, PageHeader, StatusBadge, cn } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import {
  getConservativeMarginDiagnostics,
  getConsumerLineCost,
} from '@/lib/cheffing/consumers';
import { loadCheffingConsumerDishes } from '@/lib/cheffing/consumerQueries';
import { getMenuConservativeCostDiagnostics, getNetPriceFromGross } from '@/lib/cheffing/menuEconomics';
import { normalizeMenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';
import {
  CheffingEmptyState,
  CheffingLinkButton,
  CheffingTableActionLink,
  cheffingNumericClassName,
  cheffingRowClassName,
  cheffingTableClassName,
  cheffingTheadClassName,
} from '@/app/(cheffing)/cheffing/components/CheffingUi';

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
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return `${value.toFixed(2)} \u20ac`;
  };

  const entries = (menus ?? []).map((menu) => {
    const menuItems = itemsByMenuId.get(menu.id) ?? [];
    const costDiagnostics = getMenuConservativeCostDiagnostics(
      menuItems.map((item) => ({
        section_kind: (item.section_kind ?? 'starter') as 'starter' | 'main' | 'drink' | 'dessert',
        lineName: dishById.get(item.dish_id)?.name ?? 'Linea sin plato/bebida',
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
    <>
      <PageHeader
        eyebrow="Cheffing"
        title="Menús"
        description="Consumidor por persona con coste total y margen conservador."
        actions={
          <CheffingLinkButton href="/cheffing/menus/new" tone="success">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Nuevo menú
          </CheffingLinkButton>
        }
      />

      <DataTableShell
        title="Listado de menús"
        description="Coste, precio por persona y margen calculado con criterio conservador."
        footer={`${entries.length} menús`}
      >
        <table className={cn(cheffingTableClassName, 'min-w-[980px]')}>
          <thead className={cheffingTheadClassName}>
            <tr className="border-b border-slate-800/80">
              <th className="w-[30%] px-4 py-3 font-semibold text-slate-300">Menú</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Estado</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Coste total</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Precio persona</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Margen persona</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
            {entries.length === 0 ? (
              <CheffingEmptyState colSpan={6} title="No hay menús." description="Crea un menú para calcular coste por persona." />
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className={cheffingRowClassName}>
                  <td className="px-4 py-3 align-middle">
                    <Link
                      href={`/cheffing/menus/${entry.id}`}
                      className="font-semibold text-white underline-offset-4 transition hover:text-primary-100 hover:underline"
                    >
                      {entry.name}
                    </Link>
                    {entry.notes ? <p className="mt-1 text-xs text-slate-500">{entry.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <StatusBadge tone={entry.is_active ? 'success' : 'muted'}>
                      {entry.is_active ? 'Activo' : 'Inactivo'}
                    </StatusBadge>
                  </td>
                  <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                    <p>{formatCurrency(entry.total_cost)}</p>
                    {entry.calculation_issue ? (
                      <p className="mt-1 text-xs text-amber-300">{entry.calculation_issue}</p>
                    ) : null}
                  </td>
                  <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                    {formatCurrency(entry.price_per_person)}
                  </td>
                  <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                    {formatCurrency(entry.total_margin)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex justify-end">
                      <CheffingTableActionLink href={`/cheffing/menus/${entry.id}`}>
                        <EyeIcon className="h-4 w-4" aria-hidden="true" />
                        Ver detalle
                      </CheffingTableActionLink>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
