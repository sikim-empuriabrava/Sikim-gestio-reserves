import { PlusIcon } from '@heroicons/react/24/outline';

import { PageHeader } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { IngredientCost, Unit } from '@/lib/cheffing/types';
import { CheffingLinkButton } from '@/app/(cheffing)/cheffing/components/CheffingUi';

import { ProductsManager } from './ProductsManager';

export default async function CheffingProductosPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('v_cheffing_ingredients_cost')
    .select(
      'id, name, purchase_unit_code, purchase_pack_qty, purchase_price, waste_pct, created_at, updated_at, purchase_unit_dimension, purchase_unit_factor, cost_gross_per_base, cost_net_per_base, waste_factor',
    )
    .order('name', { ascending: true });
  const { data: ingredientImages, error: ingredientImagesError } = await supabase
    .from('cheffing_ingredients')
    .select('id, image_path, updated_at');
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (ingredientsError || unitsError || ingredientImagesError) {
    console.error(
      '[cheffing/productos] Failed to load products',
      ingredientsError ?? unitsError ?? ingredientImagesError,
    );
  }

  const imageById = new Map<string, { image_path: string | null; updated_at: string }>(
    (ingredientImages ?? []).map((item) => [
      item.id,
      { image_path: item.image_path ?? null, updated_at: item.updated_at },
    ]),
  );

  const enrichedIngredients =
    ingredients?.map((ingredient) => {
      const imageData = imageById.get(ingredient.id);
      return {
        ...ingredient,
        image_path: imageData?.image_path ?? null,
        updated_at: imageData?.updated_at ?? ingredient.updated_at,
      };
    }) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Cheffing"
        title="Productos"
        description="Gestiona los productos que compras a proveedores y calcula sus costes unitarios."
        actions={
          <CheffingLinkButton href="/cheffing/productos/new" tone="primary">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Nuevo producto
          </CheffingLinkButton>
        }
      />

      <ProductsManager
        initialIngredients={enrichedIngredients as IngredientCost[]}
        units={(units ?? []) as Unit[]}
      />
    </>
  );
}
