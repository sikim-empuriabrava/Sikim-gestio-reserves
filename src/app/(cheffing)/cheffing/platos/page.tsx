import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { DishesManager, type DishCost } from './DishesManager';

export default async function CheffingPlatosPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: dishes, error: dishesError } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, servings, notes, created_at, updated_at, items_cost_total, cost_per_serving')
    .order('name', { ascending: true });
  const { data: dishImages, error: dishImagesError } = await supabase
    .from('cheffing_dishes')
    .select('id, image_path, updated_at');

  if (dishesError || dishImagesError) {
    console.error('[cheffing/platos] Failed to load dishes', dishesError ?? dishImagesError);
  }

  const imageById = new Map<string, { image_path: string | null; updated_at: string }>(
    (dishImages ?? []).map((item) => [item.id, { image_path: item.image_path ?? null, updated_at: item.updated_at }]),
  );

  const enrichedDishes =
    dishes?.map((dish) => {
      const imageData = imageById.get(dish.id);
      return {
        ...dish,
        image_path: imageData?.image_path ?? null,
        updated_at: imageData?.updated_at ?? dish.updated_at,
      };
    }) ?? [];

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Platos</h2>
        <p className="text-sm text-slate-400">
          Organiza los platos finales y calcula el coste total a partir de productos y elaboraciones.
        </p>
      </header>

      <DishesManager initialDishes={enrichedDishes as DishCost[]} />
    </section>
  );
}
