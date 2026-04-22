import type { SupabaseClient } from '@supabase/supabase-js';

type IncomingMenuAssignment = {
  menuId?: string;
  assignedPax?: number;
  sortOrder?: number;
  notes?: string | null;
};

type ParsedMenuAssignment = {
  menuId: string;
  assignedPax: number;
  sortOrder: number;
  notes: string | null;
};

export function parseMenuAssignments(input: unknown): ParsedMenuAssignment[] | null {
  if (input === undefined) {
    return null;
  }

  if (!Array.isArray(input)) {
    throw new Error('menuAssignments must be an array');
  }

  return input.map((item, index) => {
    const assignment = (item ?? {}) as IncomingMenuAssignment;
    const menuId = assignment.menuId?.trim();

    if (!menuId) {
      throw new Error(`menuAssignments[${index}].menuId is required`);
    }

    const assignedPax = Number(assignment.assignedPax);
    if (!Number.isInteger(assignedPax) || assignedPax <= 0) {
      throw new Error(`menuAssignments[${index}].assignedPax must be a positive integer`);
    }

    const sortOrder = assignment.sortOrder === undefined ? index : Number(assignment.sortOrder);
    if (!Number.isInteger(sortOrder)) {
      throw new Error(`menuAssignments[${index}].sortOrder must be an integer`);
    }

    return {
      menuId,
      assignedPax,
      sortOrder,
      notes: assignment.notes?.trim() || null,
    };
  });
}

export async function syncCheffingMenuAssignments({
  supabase,
  groupEventId,
  assignments,
}: {
  supabase: SupabaseClient;
  groupEventId: string;
  assignments: ParsedMenuAssignment[];
}) {
  const menuIds = Array.from(new Set(assignments.map((item) => item.menuId)));

  const { data: menus, error: menusError } = await supabase
    .from('cheffing_menus')
    .select('id, name, price_per_person')
    .in('id', menuIds);

  if (menusError) {
    throw new Error(menusError.message ?? 'Unable to load Cheffing menus');
  }

  const menusById = new Map((menus ?? []).map((menu) => [menu.id, menu]));

  for (const assignment of assignments) {
    if (!menusById.has(assignment.menuId)) {
      throw new Error(`menuAssignments contains unknown menuId: ${assignment.menuId}`);
    }
  }

  const { error: deleteError } = await supabase
    .from('group_event_offerings')
    .delete()
    .eq('group_event_id', groupEventId)
    .eq('offering_kind', 'cheffing_menu');

  if (deleteError) {
    throw new Error(deleteError.message ?? 'Unable to clear previous menu assignments');
  }

  if (assignments.length > 0) {
    const rows = assignments.map((assignment) => {
      const menu = menusById.get(assignment.menuId);

      return {
        group_event_id: groupEventId,
        offering_kind: 'cheffing_menu',
        cheffing_menu_id: assignment.menuId,
        cheffing_card_id: null,
        assigned_pax: assignment.assignedPax,
        display_name_snapshot: menu?.name ?? 'Menú sin nombre',
        unit_price_snapshot: menu?.price_per_person ?? null,
        notes: assignment.notes,
        sort_order: assignment.sortOrder,
        snapshot_payload: {
          source_kind: 'cheffing_menu',
          source_menu_id: assignment.menuId,
          source_menu_name: menu?.name ?? null,
          source_price_per_person: menu?.price_per_person ?? null,
        },
      };
    });

    const { error: insertError } = await supabase.from('group_event_offerings').insert(rows);

    if (insertError) {
      throw new Error(insertError.message ?? 'Unable to save menu assignments');
    }
  }

  const { error: unlinkLegacyError } = await supabase
    .from('group_events')
    .update({ menu_id: null })
    .eq('id', groupEventId);

  if (unlinkLegacyError) {
    throw new Error(unlinkLegacyError.message ?? 'Unable to unlink legacy menu_id');
  }
}

export type { ParsedMenuAssignment };
