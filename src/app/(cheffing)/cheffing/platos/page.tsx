import { PlusIcon } from '@heroicons/react/24/outline';

import { PageHeader } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { DishesManager, type DishCost } from './DishesManager';
import type { CheffingFamily } from '@/lib/cheffing/families';
import { buildDishUsageIndex, loadCheffingDishUsage } from '@/lib/cheffing/dishUsage';
import { CheffingLinkButton } from '@/app/(cheffing)/cheffing/components/CheffingUi';

type DishImageRow = {
  id: string;
  image_path: string | null;
  updated_at: string;
  family_id: string | null;
  cheffing_families: { name: string | null; kind: 'food' | 'drink' | null } | null;
};

export default async function CheffingPlatosPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [
    { data: dishes, error: dishesError },
    { data: dishImages, error: dishImagesError },
    { data: families, error: familiesError },
    { rows: dishUsageRows, error: dishUsageError },
  ] = await Promise.all([
    supabase
      .from('v_cheffing_dish_cost')
      .select('id, name, selling_price, servings, notes, created_at, updated_at, items_cost_total, cost_per_serving')
      .order('name', { ascending: true }),
    supabase.from('cheffing_dishes').select('id, image_path, updated_at, family_id, cheffing_families(name, kind)'),
    supabase
      .from('cheffing_families')
      .select('id, name, slug, sort_order, is_active, kind')
      .eq('is_active', true)
      .eq('kind', 'food')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    loadCheffingDishUsage(),
  ]);

  if (dishesError || dishImagesError || familiesError || dishUsageError) {
    console.error('[cheffing/platos] Failed to load dishes', dishesError ?? dishImagesError ?? familiesError ?? dishUsageError);
  }

  const dishImageRows = (dishImages ?? []) as unknown as DishImageRow[];
  const visibleDishIds = new Set(
    dishImageRows
      .filter((item) => item.family_id === null || item.cheffing_families?.kind === 'food')
      .map((item) => item.id),
  );
  const imageById = new Map<string, { image_path: string | null; updated_at: string }>(
    dishImageRows
      .filter((item) => visibleDishIds.has(item.id))
      .map((item) => [item.id, { image_path: item.image_path ?? null, updated_at: item.updated_at }]),
  );
  const familyById = new Map<string, { id: string | null; name: string | null }>(
    dishImageRows.map((item) => [
      item.id,
      {
        id: item.family_id ?? null,
        name: item.cheffing_families?.name ?? null,
      },
    ]),
  );

  const usageByDishId = buildDishUsageIndex(dishUsageRows);

  const enrichedDishes =
    dishes?.filter((dish) => visibleDishIds.has(dish.id)).map((dish) => {
      const imageData = imageById.get(dish.id);
      const usage = usageByDishId.get(dish.id);
      return {
        ...dish,
        image_path: imageData?.image_path ?? null,
        updated_at: imageData?.updated_at ?? dish.updated_at,
        family_id: familyById.get(dish.id)?.id ?? null,
        family_name: familyById.get(dish.id)?.name ?? null,
        usage_cards: usage?.cards ?? [],
        usage_menus: usage?.menus ?? [],
        usage_has_any: usage?.hasAnyUsage ?? false,
        usage_has_active: usage?.hasActiveUsage ?? false,
      };
    }) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Cheffing"
        title="Platos"
        description="Organiza platos finales y calcula el coste total a partir de productos y elaboraciones."
        actions={
          <CheffingLinkButton href="/cheffing/platos/new" tone="success">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Nuevo plato
          </CheffingLinkButton>
        }
      />

      <DishesManager
        initialDishes={enrichedDishes as DishCost[]}
        families={(families ?? []) as CheffingFamily[]}
      />
    </>
  );
}
