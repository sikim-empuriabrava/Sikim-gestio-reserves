import { notFound } from 'next/navigation';
import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { isAdmin } from '@/lib/auth/requireRole';
import type { Ingredient, Unit } from '@/lib/cheffing/types';
import { resolveConsumerDishHref } from '@/lib/cheffing/consumers';

import { ProductsNewForm } from '../ProductsNewForm';

export default async function CheffingProductoDetailPage({ params }: { params: { id: string } }) {
  const { allowlistInfo } = await requireCheffingAccess();
  const canManageImages =
    isAdmin(allowlistInfo.role) || Boolean(allowlistInfo.allowedUser?.cheffing_images_manage);

  const supabase = createSupabaseServerClient();
  const { data: rawProduct, error: productError } = await supabase
    .from('cheffing_ingredients')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (productError || !rawProduct) {
    console.error('[cheffing/productos] Failed to load product', productError);
    notFound();
  }

  const product: Ingredient = {
    ...rawProduct,
    categories: Array.isArray(rawProduct.categories) ? rawProduct.categories : [],
    reference: typeof rawProduct.reference === 'string' ? rawProduct.reference : null,
    stock_unit_code: typeof rawProduct.stock_unit_code === 'string' ? rawProduct.stock_unit_code : null,
    stock_qty: typeof rawProduct.stock_qty === 'number' ? rawProduct.stock_qty : 0,
    min_stock_qty: typeof rawProduct.min_stock_qty === 'number' ? rawProduct.min_stock_qty : null,
    max_stock_qty: typeof rawProduct.max_stock_qty === 'number' ? rawProduct.max_stock_qty : null,
    allergens: Array.isArray(rawProduct.allergen_codes) ? rawProduct.allergen_codes : [],
    indicators: Array.isArray(rawProduct.indicator_codes) ? rawProduct.indicator_codes : [],
    image_path: typeof rawProduct.image_path === 'string' ? rawProduct.image_path : null,
  };

  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });
  const { data: subrecipeUsageRows, error: subrecipeUsageRowsError } = await supabase
    .from('cheffing_subrecipe_items')
    .select('subrecipe_id')
    .eq('ingredient_id', params.id);
  const subrecipeIds = Array.from(new Set((subrecipeUsageRows ?? []).map((row) => row.subrecipe_id)));
  const { data: subrecipesUsingIngredient, error: subrecipesUsingIngredientError } =
    subrecipeIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from('cheffing_subrecipes')
          .select('id, name')
          .in('id', subrecipeIds)
          .order('name', { ascending: true });

  const { data: dishUsageRows, error: dishUsageRowsError } = await supabase
    .from('cheffing_dish_items')
    .select('dish_id')
    .eq('ingredient_id', params.id);
  const dishIds = Array.from(new Set((dishUsageRows ?? []).map((row) => row.dish_id)));
  const { data: dishesUsingIngredient, error: dishesUsingIngredientError } =
    dishIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from('cheffing_dishes')
          .select('id, name, cheffing_families(kind)')
          .in('id', dishIds)
          .order('name', { ascending: true });

  if (
    unitsError ||
    subrecipeUsageRowsError ||
    subrecipesUsingIngredientError ||
    dishUsageRowsError ||
    dishesUsingIngredientError
  ) {
    console.error(
      '[cheffing/productos] Failed to load detail relations',
      unitsError ??
        subrecipeUsageRowsError ??
        subrecipesUsingIngredientError ??
        dishUsageRowsError ??
        dishesUsingIngredientError,
    );
  }

  const dishesUsageLinks = (dishesUsingIngredient ?? []).map((dish) => {
    const family = Array.isArray(dish.cheffing_families) ? dish.cheffing_families[0] : dish.cheffing_families;
    const familyKind = family?.kind === 'drink' ? 'drink' : 'food';
    return {
      id: dish.id,
      name: dish.name,
      href: resolveConsumerDishHref({ id: dish.id, family_kind: familyKind }),
      kindLabel: familyKind === 'drink' ? 'Bebida' : 'Plato',
    } as const;
  });

  return (
    <section className="space-y-6">
      <div className="text-sm text-slate-400">
        <Link href="/cheffing" className="mr-2 underline-offset-2 hover:text-slate-200 hover:underline">
          Cheffing
        </Link>
        /
        <Link href="/cheffing/productos" className="mx-2 underline-offset-2 hover:text-slate-200 hover:underline">
          Productos
        </Link>
        /<span className="ml-2 text-white">{product.name}</span>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
        <ProductsNewForm
          units={(units ?? []) as Unit[]}
          initialProduct={product}
          productId={params.id}
          canManageImages={canManageImages}
        />
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold text-white">Dónde se usa este ingrediente</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-500">Subrecetas</p>
            {(subrecipesUsingIngredient ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No se usa en subrecetas.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {(subrecipesUsingIngredient ?? []).map((subrecipe) => (
                  <li key={subrecipe.id}>
                    <Link
                      href={`/cheffing/elaboraciones/${subrecipe.id}`}
                      className="text-slate-200 underline-offset-2 transition hover:text-emerald-200 hover:underline"
                    >
                      {subrecipe.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Platos y bebidas</p>
            {dishesUsageLinks.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No se usa directamente en platos o bebidas.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {dishesUsageLinks.map((dish) => (
                  <li key={dish.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={dish.href}
                      className="text-slate-200 underline-offset-2 transition hover:text-emerald-200 hover:underline"
                    >
                      {dish.name}
                    </Link>
                    <span className="text-xs text-slate-400">{dish.kindLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
