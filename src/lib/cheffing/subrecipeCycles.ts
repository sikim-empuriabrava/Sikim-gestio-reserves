import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

type SubrecipeItemEdge = {
  id: string;
  subrecipe_id: string;
  subrecipe_component_id: string | null;
};

type CycleCheckResult =
  | { hasCycle: true }
  | { hasCycle: false }
  | { hasCycle: false; error: PostgrestError };

export const wouldCreateSubrecipeCycle = async (
  supabase: SupabaseClient,
  parentId: string,
  componentId: string,
  ignoreItemId?: string,
): Promise<CycleCheckResult> => {
  if (parentId === componentId) {
    return { hasCycle: true };
  }

  const { data, error } = await supabase
    .from('cheffing_subrecipe_items')
    .select('id, subrecipe_id, subrecipe_component_id')
    .not('subrecipe_component_id', 'is', null);

  if (error) {
    return { hasCycle: false, error };
  }

  const adjacency = new Map<string, string[]>();

  (data as SubrecipeItemEdge[]).forEach((edge) => {
    if (!edge.subrecipe_component_id) return;
    if (ignoreItemId && edge.id === ignoreItemId) return;
    const list = adjacency.get(edge.subrecipe_id) ?? [];
    list.push(edge.subrecipe_component_id);
    adjacency.set(edge.subrecipe_id, list);
  });

  const nextList = adjacency.get(parentId) ?? [];
  nextList.push(componentId);
  adjacency.set(parentId, nextList);

  const stack = [componentId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current === parentId) {
      return { hasCycle: true };
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const neighbors = adjacency.get(current) ?? [];
    neighbors.forEach((neighbor) => stack.push(neighbor));
  }

  return { hasCycle: false };
};
