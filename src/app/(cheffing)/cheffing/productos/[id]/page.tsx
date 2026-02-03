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
  const { data: product, error: productError } = await supabase
    .from('cheffing_ingredients')
    .select(
      'id, name, purchase_unit_code, purchase_pack_qty, purchase_price, waste_pct, categories, reference, stock_unit_code, stock_qty, min_stock_qty, max_stock_qty, allergens, indicators, image_path, created_at, updated_at',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (productError || !product) {
    console.error('[cheffing/productos] Failed to load product', productError);
    notFound();
  }

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
          initialProduct={product as Ingredient}
          productId={params.id}
          canManageImages={canManageImages}
        />
      </div>
    </section>
  );
}
