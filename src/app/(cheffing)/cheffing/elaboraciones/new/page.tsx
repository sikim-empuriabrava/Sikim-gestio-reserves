import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { isAdmin } from '@/lib/auth/requireRole';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';

import { SubrecipeNewForm } from '../SubrecipeNewForm';

export default async function CheffingElaboracionesNewPage() {
  const { allowlistInfo } = await requireCheffingAccess();
  const canManageImages =
    isAdmin(allowlistInfo.role) || Boolean(allowlistInfo.allowedUser?.cheffing_images_manage);

  const supabase = createSupabaseServerClient();
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('cheffing_ingredients')
    .select('id, name, purchase_unit_code, purchase_pack_qty, purchase_price, waste_pct, created_at, updated_at')
    .order('name', { ascending: true });
  const { data: subrecipes, error: subrecipesError } = await supabase
    .from('cheffing_subrecipes')
    .select('id, name, output_unit_code, output_qty, waste_pct, notes, created_at, updated_at')
    .order('name', { ascending: true });
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (ingredientsError || subrecipesError || unitsError) {
    console.error(
      '[cheffing/elaboraciones/new] Failed to load data',
      ingredientsError ?? subrecipesError ?? unitsError,
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Nueva elaboración</h2>
        <p className="text-sm text-slate-400">
          Define elaboraciones para reutilizarlas en platos y escandallos.
        </p>
      </header>

      <SubrecipeNewForm
        ingredients={(ingredients ?? []) as Ingredient[]}
        subrecipes={(subrecipes ?? []) as Subrecipe[]}
        units={(units ?? []) as Unit[]}
        canManageImages={canManageImages}
      />
    </section>
  );
}
