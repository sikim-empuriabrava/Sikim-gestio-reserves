import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CheffingConsumerDish } from '@/lib/cheffing/consumers';

export async function loadCheffingConsumerDishes() {
  const supabase = createSupabaseServerClient();

  const { data: dishCosts, error: dishCostsError } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, items_cost_total')
    .order('name', { ascending: true });

  const { data: dishFamilies, error: dishFamiliesError } = await supabase
    .from('cheffing_dishes')
    .select('id, family_id, cheffing_families(name, kind)');

  if (dishCostsError || dishFamiliesError) {
    console.error('[cheffing/consumers] Failed to load dishes', dishCostsError ?? dishFamiliesError);
  }

  const familyByDishId = new Map<string, { family_name: string | null; family_kind: 'food' | 'drink' | null }>();
  (dishFamilies ?? []).forEach((row) => {
    const relation = Array.isArray(row.cheffing_families) ? row.cheffing_families[0] : row.cheffing_families;
    familyByDishId.set(row.id, {
      family_name: relation?.name ?? null,
      family_kind: relation?.kind ?? null,
    });
  });

  const dishes: CheffingConsumerDish[] = (dishCosts ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    selling_price: row.selling_price ?? null,
    items_cost_total: row.items_cost_total ?? null,
    family_name: familyByDishId.get(row.id)?.family_name ?? null,
    family_kind: familyByDishId.get(row.id)?.family_kind ?? null,
  }));

  return { dishes, error: dishCostsError ?? dishFamiliesError ?? null };
}
