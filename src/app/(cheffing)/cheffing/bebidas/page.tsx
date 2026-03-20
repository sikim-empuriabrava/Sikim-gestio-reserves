import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { DishesManager, type DishCost } from '@/app/(cheffing)/cheffing/platos/DishesManager';
import type { CheffingFamily } from '@/lib/cheffing/families';

type DishImageRow = {
  id: string;
  image_path: string | null;
  updated_at: string;
  family_id: string | null;
  cheffing_families: { name: string | null; kind: 'food' | 'drink' | null } | null;
};

export default async function CheffingBebidasPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: dishes, error: dishesError } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, servings, notes, created_at, updated_at, items_cost_total, cost_per_serving')
    .order('name', { ascending: true });
  const { data: dishImages, error: dishImagesError } = await supabase
    .from('cheffing_dishes')
    .select('id, image_path, updated_at, family_id, cheffing_families(name, kind)');
  const { data: families, error: familiesError } = await supabase
    .from('cheffing_families')
    .select('id, name, slug, sort_order, is_active, kind')
    .eq('is_active', true)
    .eq('kind', 'drink')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (dishesError || dishImagesError || familiesError) {
    console.error('[cheffing/bebidas] Failed to load drinks', dishesError ?? dishImagesError ?? familiesError);
  }

  const dishImageRows = (dishImages ?? []) as unknown as DishImageRow[];
  const visibleDishIds = new Set(
    dishImageRows.filter((item) => item.family_id !== null && item.cheffing_families?.kind === 'drink').map((item) => item.id),
  );
  const imageById = new Map<string, { image_path: string | null; updated_at: string }>(
    dishImageRows
      .filter((item) => visibleDishIds.has(item.id))
      .map((item) => [item.id, { image_path: item.image_path ?? null, updated_at: item.updated_at }]),
  );
  const familyById = new Map<string, { id: string | null; name: string | null }>(
    dishImageRows
      .filter((item) => visibleDishIds.has(item.id))
      .map((item) => [
        item.id,
        {
          id: item.family_id ?? null,
          name: item.cheffing_families?.name ?? null,
        },
      ]),
  );

  const enrichedDishes =
    dishes?.filter((dish) => visibleDishIds.has(dish.id)).map((dish) => {
      const imageData = imageById.get(dish.id);
      return {
        ...dish,
        image_path: imageData?.image_path ?? null,
        updated_at: imageData?.updated_at ?? dish.updated_at,
        family_id: familyById.get(dish.id)?.id ?? null,
        family_name: familyById.get(dish.id)?.name ?? null,
      };
    }) ?? [];

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Bebidas</h2>
        <p className="text-sm text-slate-400">
          Gestiona bebidas finales y calcula el coste total a partir de productos y elaboraciones.
        </p>
      </header>

      <DishesManager
        initialDishes={enrichedDishes as DishCost[]}
        families={(families ?? []) as CheffingFamily[]}
        basePath="/cheffing/bebidas"
        entityLabelSingular="bebida"
        entityLabelPlural="bebidas"
      />
    </section>
  );
}
