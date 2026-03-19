import { createClient } from '@supabase/supabase-js';

import { resolveDishFamilyFromSourceTags } from '../../src/lib/cheffing/menuEngineeringFamily';
import { SIN_FAMILIA_LABEL } from '../../src/lib/cheffing/families';

type DishRow = {
  id: string;
  mycheftool_source_tag_names: string[] | null;
};

type FamilyRow = {
  id: string;
  name: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const getFamilyByNameCi = async () => {
  const { data, error } = await supabase
    .from('cheffing_families')
    .select('id, name');

  if (error) throw error;
  const byNameCi = new Map<string, FamilyRow>();
  for (const row of (data ?? []) as FamilyRow[]) {
    byNameCi.set(row.name.toLowerCase(), row);
  }
  return byNameCi;
};

async function main() {
  const familyByNameCi = await getFamilyByNameCi();
  const { data: dishes, error } = await supabase
    .from('cheffing_dishes')
    .select('id, mycheftool_source_tag_names');

  if (error) throw error;

  const updates: { id: string; family_id: string | null }[] = [];
  let withoutFamilyCount = 0;
  let unresolvedCatalogFamilyCount = 0;

  for (const dish of (dishes ?? []) as DishRow[]) {
    const resolvedFamily = resolveDishFamilyFromSourceTags(
      Array.isArray(dish.mycheftool_source_tag_names) ? dish.mycheftool_source_tag_names : [],
    );

    if (!resolvedFamily || resolvedFamily === SIN_FAMILIA_LABEL) {
      updates.push({ id: dish.id, family_id: null });
      withoutFamilyCount += 1;
      continue;
    }

    const familyId = familyByNameCi.get(resolvedFamily.toLowerCase())?.id ?? null;
    if (!familyId) {
      unresolvedCatalogFamilyCount += 1;
      withoutFamilyCount += 1;
    }
    updates.push({ id: dish.id, family_id: familyId });
  }

  const batchSize = 200;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    for (const row of batch) {
      const { error: updateError } = await supabase
        .from('cheffing_dishes')
        .update({ family_id: row.family_id })
        .eq('id', row.id);
      if (updateError) throw updateError;
    }
  }

  console.log(
    `[backfill-dish-families] done. Dishes processed=${updates.length}, without_family=${withoutFamilyCount}, unresolved_catalog_family=${unresolvedCatalogFamilyCount}.`,
  );
}

main().catch((error) => {
  console.error('[backfill-dish-families] failed', error);
  process.exit(1);
});
