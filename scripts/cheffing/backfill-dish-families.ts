import { createClient } from '@supabase/supabase-js';

import { resolveDishFamilyFromSourceTags } from '../../src/lib/cheffing/menuEngineeringFamily';
import { SIN_FAMILIA_LABEL, slugifyFamilyName } from '../../src/lib/cheffing/families';

type DishRow = {
  id: string;
  mycheftool_source_tag_names: string[] | null;
};

type FamilyRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const getFamilyCache = async () => {
  const { data, error } = await supabase
    .from('cheffing_families')
    .select('id, name, slug, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  const byNameCi = new Map<string, FamilyRow>();
  const bySlug = new Map<string, FamilyRow>();
  for (const row of (data ?? []) as FamilyRow[]) {
    byNameCi.set(row.name.toLowerCase(), row);
    bySlug.set(row.slug, row);
  }
  const maxSortOrder = (data ?? []).reduce((max, row) => Math.max(max, row.sort_order ?? 0), -1);
  return { byNameCi, bySlug, maxSortOrder };
};

const ensureFamily = async (
  rawName: string,
  state: { byNameCi: Map<string, FamilyRow>; bySlug: Map<string, FamilyRow>; maxSortOrder: number },
) => {
  const trimmedName = rawName.trim();
  const key = trimmedName.toLowerCase();
  const existing = state.byNameCi.get(key);
  if (existing) return existing.id;

  const baseSlug = slugifyFamilyName(trimmedName) || 'family';
  let candidateSlug = baseSlug;
  let suffix = 2;
  while (state.bySlug.has(candidateSlug)) {
    candidateSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const nextSortOrder = state.maxSortOrder + 1;
  const { data, error } = await supabase
    .from('cheffing_families')
    .insert({
      name: trimmedName,
      slug: candidateSlug,
      sort_order: nextSortOrder,
      is_active: true,
    })
    .select('id, name, slug, sort_order')
    .single();

  if (error) throw error;
  const row = data as FamilyRow;
  state.byNameCi.set(row.name.toLowerCase(), row);
  state.bySlug.set(row.slug, row);
  state.maxSortOrder = Math.max(state.maxSortOrder, row.sort_order ?? nextSortOrder);
  return row.id;
};

async function main() {
  const familyCache = await getFamilyCache();
  const { data: dishes, error } = await supabase
    .from('cheffing_dishes')
    .select('id, mycheftool_source_tag_names');

  if (error) throw error;

  const updates: { id: string; family_id: string | null }[] = [];
  let createdFamilies = 0;

  for (const dish of (dishes ?? []) as DishRow[]) {
    const resolvedFamily = resolveDishFamilyFromSourceTags(
      Array.isArray(dish.mycheftool_source_tag_names) ? dish.mycheftool_source_tag_names : [],
    );

    if (!resolvedFamily || resolvedFamily === SIN_FAMILIA_LABEL) {
      updates.push({ id: dish.id, family_id: null });
      continue;
    }

    const currentSize = familyCache.byNameCi.size;
    const familyId = await ensureFamily(resolvedFamily, familyCache);
    if (familyCache.byNameCi.size > currentSize) createdFamilies += 1;
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
    `[backfill-dish-families] done. Dishes processed=${updates.length}, new families=${createdFamilies}.`,
  );
}

main().catch((error) => {
  console.error('[backfill-dish-families] failed', error);
  process.exit(1);
});
