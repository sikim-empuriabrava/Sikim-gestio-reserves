create or replace function public.sync_group_event_cheffing_menu_offerings(
  p_group_event_id uuid,
  p_menu_assignments jsonb,
  p_allow_existing_inactive boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_menu_assignments is null then
    return;
  end if;

  if jsonb_typeof(p_menu_assignments) <> 'array' then
    raise exception 'menuAssignments must be an array';
  end if;

  if exists (
    select 1
    from public.group_event_offerings offered
    join public.group_event_offering_selections sel
      on sel.group_event_offering_id = offered.id
    where offered.group_event_id = p_group_event_id
  )
  or exists (
    select 1
    from public.group_event_offerings offered
    join public.group_event_offering_selections sel
      on sel.group_event_offering_id = offered.id
    join public.group_event_offering_selection_doneness don
      on don.selection_id = sel.id
    where offered.group_event_id = p_group_event_id
  ) then
    raise exception 'menuAssignments is not allowed for structured reservations. Use offeringAssignments with secondSelections.';
  end if;

  perform public.sync_group_event_offerings(
    p_group_event_id,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'offeringKind', 'cheffing_menu',
            'offeringId', entry ->> 'menuId',
            'assignedPax', entry -> 'assignedPax',
            'sortOrder', coalesce(entry -> 'sortOrder', to_jsonb((ordinality - 1)::integer)),
            'notes', entry -> 'notes',
            'secondSelections', '[]'::jsonb
          )
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(p_menu_assignments) with ordinality as e(entry, ordinality)
    ),
    p_allow_existing_inactive
  );
end;
$$;
