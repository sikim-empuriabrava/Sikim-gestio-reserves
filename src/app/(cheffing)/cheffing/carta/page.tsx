import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { loadCheffingConsumerDishes } from '@/lib/cheffing/consumerQueries';
import { getConsumerConservativeCostTotal, getConsumerLineCost } from '@/lib/cheffing/consumers';

import { CheffingConsumerList } from '@/app/(cheffing)/cheffing/components/CheffingConsumerList';

export default async function CheffingCartaPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [{ data: cards, error: cardsError }, { data: items, error: itemsError }, { dishes }] = await Promise.all([
    supabase
      .from('cheffing_cards')
      .select('id, name, notes, is_active, created_at, updated_at')
      .order('name', { ascending: true }),
    supabase
      .from('cheffing_card_items')
      .select('id, card_id, dish_id, multiplier, sort_order, notes, created_at, updated_at')
      .order('sort_order', { ascending: true }),
    loadCheffingConsumerDishes(),
  ]);

  if (cardsError || itemsError) {
    console.error('[cheffing/carta] Failed to load cards', cardsError ?? itemsError);
  }

  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  const itemsByCardId = new Map<string, typeof items>();
  (items ?? []).forEach((item) => {
    const list = itemsByCardId.get(item.card_id) ?? [];
    list.push(item);
    itemsByCardId.set(item.card_id, list);
  });

  const entries = (cards ?? []).map((card) => {
    const cardItems = itemsByCardId.get(card.id) ?? [];
    const costDiagnostics = getConsumerConservativeCostTotal(
      cardItems.map((item) => ({
        lineName: dishById.get(item.dish_id)?.name ?? 'Línea sin plato/bebida',
        cost: getConsumerLineCost(dishById.get(item.dish_id)?.items_cost_total ?? null, item.multiplier),
      })),
    );

    return {
      ...card,
      total_cost: costDiagnostics.total,
      calculation_issue: costDiagnostics.blocking_reasons[0] ?? null,
    };
  });

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Carta</h2>
        <p className="text-sm text-slate-400">La carta consume platos/bebidas canónicos con multiplicador decimal.</p>
      </header>

      <CheffingConsumerList
        title="Carta"
        createHref="/cheffing/carta/new"
        detailBaseHref="/cheffing/carta"
        searchPlaceholder="Buscar carta por nombre"
        showFinancials={false}
        entries={entries}
      />
    </section>
  );
}
