import { PlusIcon } from '@heroicons/react/24/outline';

import { PageHeader } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { Unit } from '@/lib/cheffing/types';
import { CheffingLinkButton } from '@/app/(cheffing)/cheffing/components/CheffingUi';

import { SubrecipesManager, type SubrecipeCost } from './SubrecipesManager';

export default async function CheffingElaboracionesPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: subrecipes, error: subrecipesError } = await supabase
    .from('v_cheffing_subrecipe_cost')
    .select(
      'id, name, output_unit_code, output_qty, waste_pct, notes, created_at, updated_at, output_unit_dimension, output_unit_factor, items_cost_total, cost_gross_per_base, cost_net_per_base, waste_factor',
    )
    .order('name', { ascending: true });
  const { data: subrecipeImages, error: subrecipeImagesError } = await supabase
    .from('cheffing_subrecipes')
    .select('id, image_path, updated_at');
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (subrecipesError || unitsError || subrecipeImagesError) {
    console.error(
      '[cheffing/elaboraciones] Failed to load subrecipes',
      subrecipesError ?? unitsError ?? subrecipeImagesError,
    );
  }

  const imageById = new Map<string, { image_path: string | null; updated_at: string }>(
    (subrecipeImages ?? []).map((item) => [
      item.id,
      { image_path: item.image_path ?? null, updated_at: item.updated_at },
    ]),
  );

  const enrichedSubrecipes =
    subrecipes?.map((subrecipe) => {
      const imageData = imageById.get(subrecipe.id);
      return {
        ...subrecipe,
        image_path: imageData?.image_path ?? null,
        updated_at: imageData?.updated_at ?? subrecipe.updated_at,
      };
    }) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Cheffing"
        title="Elaboraciones"
        description="Define producciones internas, merma y coste base por unidad para reutilizarlas en platos."
        actions={
          <CheffingLinkButton href="/cheffing/elaboraciones/new" tone="success">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Nueva elaboración
          </CheffingLinkButton>
        }
      />

      <SubrecipesManager
        initialSubrecipes={enrichedSubrecipes as SubrecipeCost[]}
        units={(units ?? []) as Unit[]}
      />
    </>
  );
}
