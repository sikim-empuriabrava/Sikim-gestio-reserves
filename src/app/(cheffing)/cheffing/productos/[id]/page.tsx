import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { isAdmin } from '@/lib/auth/requireRole';
import type { Ingredient, Unit } from '@/lib/cheffing/types';

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
    allergens: Array.isArray(rawProduct.allergens) ? rawProduct.allergens : [],
    indicators: Array.isArray(rawProduct.indicators) ? rawProduct.indicators : [],
    image_path: typeof rawProduct.image_path === 'string' ? rawProduct.image_path : null,
  };

  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (unitsError) {
    console.error('[cheffing/productos] Failed to load units', unitsError);
  }

  return (
    <section className="space-y-6">
      <div className="text-sm text-slate-400">
        <span className="mr-2">Cheffing</span>/<span className="mx-2">Productos</span>/
        <span className="ml-2 text-white">{product.name}</span>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
        <ProductsNewForm
          units={(units ?? []) as Unit[]}
          initialProduct={product}
          productId={params.id}
          canManageImages={canManageImages}
        />
      </div>
    </section>
  );
}
