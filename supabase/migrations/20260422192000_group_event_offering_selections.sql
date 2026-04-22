create table if not exists public.group_event_offering_selections (
  id uuid primary key default gen_random_uuid(),
  group_event_offering_id uuid not null references public.group_event_offerings(id) on delete cascade,
  selection_kind text not null check (selection_kind in ('menu_second', 'custom_menu', 'kids_menu')),
  cheffing_dish_id uuid null references public.cheffing_dishes(id),
  cheffing_menu_item_id uuid null references public.cheffing_menu_items(id),
  display_name_snapshot text not null,
  description_snapshot text null,
  quantity integer not null check (quantity > 0),
  notes text null,
  needs_doneness_points boolean not null default false,
  sort_order integer not null default 0,
  snapshot_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint group_event_offering_selections_reference_chk check (
    (
      selection_kind = 'menu_second'
      and cheffing_dish_id is not null
    )
    or (
      selection_kind in ('custom_menu', 'kids_menu')
      and cheffing_dish_id is null
      and cheffing_menu_item_id is null
      and length(trim(display_name_snapshot)) > 0
    )
  )
);

create table if not exists public.group_event_offering_selection_doneness (
  id uuid primary key default gen_random_uuid(),
  selection_id uuid not null references public.group_event_offering_selections(id) on delete cascade,
  point text not null check (point in ('crudo', 'poco', 'al_punto', 'hecho', 'muy_hecho')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (selection_id, point)
);

create index if not exists group_event_offering_selections_offering_sort_idx
  on public.group_event_offering_selections (group_event_offering_id, sort_order, created_at);

create index if not exists group_event_offering_selection_doneness_selection_idx
  on public.group_event_offering_selection_doneness (selection_id, point);

drop trigger if exists set_updated_at_group_event_offering_selections on public.group_event_offering_selections;
create trigger set_updated_at_group_event_offering_selections
before update on public.group_event_offering_selections
for each row
execute function public.tg_set_updated_at();

create or replace function public.rebuild_group_event_menu_text(p_group_event_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_offering record;
  v_selection record;
  v_point record;
  v_lines text[] := '{}';
  v_doneness_lines text[];
  v_doneness_summary text;
begin
  for v_offering in
    select
      offered.id,
      offered.offering_kind,
      offered.assigned_pax,
      coalesce(offered.display_name_snapshot, m.name, c.name) as display_name
    from public.group_event_offerings as offered
    left join public.cheffing_menus as m on m.id = offered.cheffing_menu_id
    left join public.cheffing_cards as c on c.id = offered.cheffing_card_id
    where offered.group_event_id = p_group_event_id
    order by offered.sort_order, offered.created_at
  loop
    v_lines := v_lines || format('%s · %s pax', coalesce(v_offering.display_name, 'Oferta sin nombre'), coalesce(v_offering.assigned_pax, 0));

    if v_offering.offering_kind = 'cheffing_menu' then
      for v_selection in
        select
          sel.id,
          sel.selection_kind,
          sel.display_name_snapshot,
          sel.quantity,
          sel.notes,
          sel.needs_doneness_points
        from public.group_event_offering_selections sel
        where sel.group_event_offering_id = v_offering.id
        order by sel.sort_order, sel.created_at
      loop
        v_lines := v_lines || format('- %s× %s', v_selection.quantity, v_selection.display_name_snapshot);

        if v_selection.notes is not null and trim(v_selection.notes) <> '' then
          v_lines := v_lines || format('  · Nota: %s', v_selection.notes);
        end if;

        if v_selection.needs_doneness_points then
          v_doneness_lines := '{}';

          for v_point in
            select point, quantity
            from public.group_event_offering_selection_doneness
            where selection_id = v_selection.id
            order by case point
              when 'crudo' then 1
              when 'poco' then 2
              when 'al_punto' then 3
              when 'hecho' then 4
              when 'muy_hecho' then 5
              else 6
            end
          loop
            v_doneness_lines := v_doneness_lines || format('%s: %s', replace(initcap(replace(v_point.point, '_', ' ')), 'Al Punto', 'Al punto'), v_point.quantity);
          end loop;

          if array_length(v_doneness_lines, 1) is not null then
            v_doneness_summary := array_to_string(v_doneness_lines, ' · ');
            v_lines := v_lines || format('  · Puntos de cocción: %s', v_doneness_summary);
          end if;
        end if;
      end loop;
    end if;
  end loop;

  update public.group_events
  set menu_text = case
      when array_length(v_lines, 1) is null then null
      else array_to_string(v_lines, E'\n')
    end,
    updated_at = timezone('utc', now())
  where id = p_group_event_id;
end;
$$;

create or replace function public.tg_group_event_offering_selections_sync_menu_text()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_group_event_id uuid;
begin
  select offered.group_event_id
  into v_group_event_id
  from public.group_event_offerings offered
  where offered.id = coalesce(new.group_event_offering_id, old.group_event_offering_id);

  if v_group_event_id is not null then
    perform public.rebuild_group_event_menu_text(v_group_event_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.tg_group_event_offering_doneness_sync_menu_text()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_group_event_id uuid;
begin
  select offered.group_event_id
  into v_group_event_id
  from public.group_event_offering_selections sel
  join public.group_event_offerings offered on offered.id = sel.group_event_offering_id
  where sel.id = coalesce(new.selection_id, old.selection_id);

  if v_group_event_id is not null then
    perform public.rebuild_group_event_menu_text(v_group_event_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_group_event_menu_text_from_selections on public.group_event_offering_selections;
create trigger sync_group_event_menu_text_from_selections
after insert or update or delete on public.group_event_offering_selections
for each row
execute function public.tg_group_event_offering_selections_sync_menu_text();

drop trigger if exists sync_group_event_menu_text_from_doneness on public.group_event_offering_selection_doneness;
create trigger sync_group_event_menu_text_from_doneness
after insert or update or delete on public.group_event_offering_selection_doneness
for each row
execute function public.tg_group_event_offering_doneness_sync_menu_text();

create or replace function public.sync_group_event_offerings(
  p_group_event_id uuid,
  p_offering_assignments jsonb,
  p_allow_existing_inactive boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_assignment jsonb;
  v_assignment_row record;
  v_second_selection jsonb;
  v_doneness jsonb;
  v_idx bigint;
  v_selection_idx bigint;
  v_doneness_idx bigint;
  v_kind text;
  v_offering_id_text text;
  v_offering_id uuid;
  v_assigned_pax_numeric numeric;
  v_assigned_pax integer;
  v_sort_order integer;
  v_notes text;
  v_second_selections jsonb;
  v_second_count integer;
  v_offering_row public.group_event_offerings;
  v_selection_kind text;
  v_display_name text;
  v_description text;
  v_quantity_numeric numeric;
  v_quantity integer;
  v_selection_sort_order integer;
  v_selection_notes text;
  v_dish_id uuid;
  v_dish_name text;
  v_dish_notes text;
  v_menu_item_id uuid;
  v_needs_doneness boolean;
  v_total_doneness integer;
  v_doneness_point text;
  v_doneness_quantity integer;
  v_doneness_quantity_numeric numeric;
  v_selection_row public.group_event_offering_selections;
begin
  if p_offering_assignments is null then
    return;
  end if;

  if jsonb_typeof(p_offering_assignments) <> 'array' then
    raise exception 'offeringAssignments must be an array';
  end if;

  create temporary table if not exists _tmp_offering_assignments (
    row_no integer not null,
    offering_kind text not null,
    cheffing_menu_id uuid null,
    cheffing_card_id uuid null,
    assigned_pax integer not null,
    sort_order integer not null,
    notes text null,
    second_selections jsonb not null default '[]'::jsonb
  ) on commit drop;

  truncate table _tmp_offering_assignments;

  for v_assignment, v_idx in
    select value, ordinality
    from jsonb_array_elements(p_offering_assignments) with ordinality
  loop
    v_kind := nullif(trim(coalesce(v_assignment ->> 'offeringKind', '')), '');

    if v_kind is null then
      if nullif(trim(coalesce(v_assignment ->> 'menuId', '')), '') is not null then
        v_kind := 'cheffing_menu';
      else
        raise exception 'offeringAssignments[%].offeringKind is required', v_idx - 1;
      end if;
    end if;

    if v_kind not in ('cheffing_menu', 'cheffing_card') then
      raise exception 'offeringAssignments[%].offeringKind is invalid', v_idx - 1;
    end if;

    if v_kind = 'cheffing_menu' then
      v_offering_id_text := nullif(trim(coalesce(v_assignment ->> 'offeringId', v_assignment ->> 'menuId', '')), '');
    else
      v_offering_id_text := nullif(trim(coalesce(v_assignment ->> 'offeringId', '')), '');
    end if;

    if v_offering_id_text is null then
      raise exception 'offeringAssignments[%].offeringId is required', v_idx - 1;
    end if;

    begin
      v_offering_id := v_offering_id_text::uuid;
    exception when others then
      raise exception 'offeringAssignments[%].offeringId must be uuid', v_idx - 1;
    end;

    begin
      v_assigned_pax_numeric := (v_assignment ->> 'assignedPax')::numeric;
    exception when others then
      raise exception 'offeringAssignments[%].assignedPax must be numeric', v_idx - 1;
    end;

    if v_assigned_pax_numeric is null
      or v_assigned_pax_numeric <> trunc(v_assigned_pax_numeric)
      or v_assigned_pax_numeric <= 0 then
      raise exception 'offeringAssignments[%].assignedPax must be a positive integer', v_idx - 1;
    end if;

    v_assigned_pax := v_assigned_pax_numeric::integer;

    if v_assignment ? 'sortOrder' and v_assignment ->> 'sortOrder' is not null then
      begin
        v_sort_order := (v_assignment ->> 'sortOrder')::integer;
      exception when others then
        raise exception 'offeringAssignments[%].sortOrder must be an integer', v_idx - 1;
      end;
    else
      v_sort_order := (v_idx - 1)::integer;
    end if;

    v_notes := nullif(trim(coalesce(v_assignment ->> 'notes', '')), '');

    if v_assignment ? 'secondSelections' then
      v_second_selections := coalesce(v_assignment -> 'secondSelections', '[]'::jsonb);
      if jsonb_typeof(v_second_selections) <> 'array' then
        raise exception 'offeringAssignments[%].secondSelections must be an array', v_idx - 1;
      end if;
    else
      v_second_selections := '[]'::jsonb;
    end if;

    v_second_count := coalesce(jsonb_array_length(v_second_selections), 0);

    if v_kind = 'cheffing_card' and v_second_count > 0 then
      raise exception 'offeringAssignments[%] with cheffing_card cannot include secondSelections', v_idx - 1;
    end if;

    insert into _tmp_offering_assignments (
      row_no,
      offering_kind,
      cheffing_menu_id,
      cheffing_card_id,
      assigned_pax,
      sort_order,
      notes,
      second_selections
    )
    values (
      (v_idx - 1)::integer,
      v_kind,
      case when v_kind = 'cheffing_menu' then v_offering_id else null end,
      case when v_kind = 'cheffing_card' then v_offering_id else null end,
      v_assigned_pax,
      v_sort_order,
      v_notes,
      v_second_selections
    );
  end loop;

  if exists (
    select 1
    from _tmp_offering_assignments t
    left join public.cheffing_menus m on m.id = t.cheffing_menu_id
    where t.offering_kind = 'cheffing_menu'
      and m.id is null
  ) then
    raise exception 'offeringAssignments contains unknown cheffing menu';
  end if;

  if exists (
    select 1
    from _tmp_offering_assignments t
    left join public.cheffing_cards c on c.id = t.cheffing_card_id
    where t.offering_kind = 'cheffing_card'
      and c.id is null
  ) then
    raise exception 'offeringAssignments contains unknown cheffing card';
  end if;

  if p_allow_existing_inactive then
    if exists (
      select 1
      from _tmp_offering_assignments t
      join public.cheffing_menus m on m.id = t.cheffing_menu_id
      left join public.group_event_offerings offered
        on offered.group_event_id = p_group_event_id
       and offered.offering_kind = 'cheffing_menu'
       and offered.cheffing_menu_id = t.cheffing_menu_id
      where t.offering_kind = 'cheffing_menu'
        and m.is_active is not true
        and offered.id is null
    ) then
      raise exception 'offeringAssignments contains inactive cheffing menu not already linked to this reservation';
    end if;

    if exists (
      select 1
      from _tmp_offering_assignments t
      join public.cheffing_cards c on c.id = t.cheffing_card_id
      left join public.group_event_offerings offered
        on offered.group_event_id = p_group_event_id
       and offered.offering_kind = 'cheffing_card'
       and offered.cheffing_card_id = t.cheffing_card_id
      where t.offering_kind = 'cheffing_card'
        and c.is_active is not true
        and offered.id is null
    ) then
      raise exception 'offeringAssignments contains inactive cheffing card not already linked to this reservation';
    end if;
  else
    if exists (
      select 1
      from _tmp_offering_assignments t
      join public.cheffing_menus m on m.id = t.cheffing_menu_id
      where t.offering_kind = 'cheffing_menu'
        and m.is_active is not true
    ) then
      raise exception 'offeringAssignments contains inactive cheffing menu';
    end if;

    if exists (
      select 1
      from _tmp_offering_assignments t
      join public.cheffing_cards c on c.id = t.cheffing_card_id
      where t.offering_kind = 'cheffing_card'
        and c.is_active is not true
    ) then
      raise exception 'offeringAssignments contains inactive cheffing card';
    end if;
  end if;

  delete from public.group_event_offerings
  where group_event_id = p_group_event_id;

  for v_idx in
    select row_no
    from _tmp_offering_assignments
    order by sort_order, row_no
  loop
    select *
    into strict v_assignment_row
    from _tmp_offering_assignments
    where row_no = v_idx;

    if v_assignment_row.offering_kind = 'cheffing_menu' then
      insert into public.group_event_offerings (
        group_event_id,
        offering_kind,
        cheffing_menu_id,
        cheffing_card_id,
        assigned_pax,
        display_name_snapshot,
        unit_price_snapshot,
        notes,
        sort_order,
        snapshot_payload
      )
      select
        p_group_event_id,
        'cheffing_menu',
        v_assignment_row.cheffing_menu_id,
        null,
        v_assignment_row.assigned_pax,
        m.name,
        m.price_per_person,
        v_assignment_row.notes,
        v_assignment_row.sort_order,
        jsonb_build_object(
          'source_kind', 'cheffing_menu',
          'source_menu_id', m.id,
          'source_menu_name', m.name,
          'source_price_per_person', m.price_per_person
        )
      from public.cheffing_menus m
      where m.id = v_assignment_row.cheffing_menu_id
      returning * into v_offering_row;
    else
      insert into public.group_event_offerings (
        group_event_id,
        offering_kind,
        cheffing_menu_id,
        cheffing_card_id,
        assigned_pax,
        display_name_snapshot,
        unit_price_snapshot,
        notes,
        sort_order,
        snapshot_payload
      )
      select
        p_group_event_id,
        'cheffing_card',
        null,
        v_assignment_row.cheffing_card_id,
        v_assignment_row.assigned_pax,
        c.name,
        null,
        v_assignment_row.notes,
        v_assignment_row.sort_order,
        jsonb_build_object(
          'source_kind', 'cheffing_card',
          'source_card_id', c.id,
          'source_card_name', c.name
        )
      from public.cheffing_cards c
      where c.id = v_assignment_row.cheffing_card_id
      returning * into v_offering_row;
    end if;

    if v_assignment_row.offering_kind = 'cheffing_menu' then
      for v_second_selection, v_selection_idx in
        select value, ordinality
        from jsonb_array_elements(v_assignment_row.second_selections) with ordinality
      loop
        v_selection_kind := nullif(trim(coalesce(v_second_selection ->> 'selectionKind', '')), '');
        if v_selection_kind not in ('menu_second', 'custom_menu', 'kids_menu') then
          raise exception 'offeringAssignments[%].secondSelections[%].selectionKind is invalid', v_idx, v_selection_idx - 1;
        end if;

        begin
          v_quantity_numeric := (v_second_selection ->> 'quantity')::numeric;
        exception when others then
          raise exception 'offeringAssignments[%].secondSelections[%].quantity must be numeric', v_idx, v_selection_idx - 1;
        end;

        if v_quantity_numeric is null
          or v_quantity_numeric <> trunc(v_quantity_numeric)
          or v_quantity_numeric <= 0 then
          raise exception 'offeringAssignments[%].secondSelections[%].quantity must be a positive integer', v_idx, v_selection_idx - 1;
        end if;
        v_quantity := v_quantity_numeric::integer;

        if v_second_selection ? 'sortOrder' and v_second_selection ->> 'sortOrder' is not null then
          begin
            v_selection_sort_order := (v_second_selection ->> 'sortOrder')::integer;
          exception when others then
            raise exception 'offeringAssignments[%].secondSelections[%].sortOrder must be an integer', v_idx, v_selection_idx - 1;
          end;
        else
          v_selection_sort_order := (v_selection_idx - 1)::integer;
        end if;

        v_selection_notes := nullif(trim(coalesce(v_second_selection ->> 'notes', '')), '');

        if v_selection_kind = 'menu_second' then
          begin
            v_dish_id := nullif(trim(coalesce(v_second_selection ->> 'dishId', '')), '')::uuid;
          exception when others then
            raise exception 'offeringAssignments[%].secondSelections[%].dishId must be uuid', v_idx, v_selection_idx - 1;
          end;

          if v_dish_id is null then
            raise exception 'offeringAssignments[%].secondSelections[%].dishId is required for menu_second', v_idx, v_selection_idx - 1;
          end if;

          select d.name, d.notes
          into v_dish_name, v_dish_notes
          from public.cheffing_dishes d
          where d.id = v_dish_id;

          if v_dish_name is null then
            raise exception 'offeringAssignments[%].secondSelections[%].dishId not found', v_idx, v_selection_idx - 1;
          end if;

          v_display_name := nullif(trim(coalesce(v_second_selection ->> 'displayName', '')), '');
          if v_display_name is null then
            v_display_name := v_dish_name;
          end if;

          v_description := nullif(trim(coalesce(v_second_selection ->> 'description', '')), '');

          if v_second_selection ? 'menuItemId' and nullif(trim(coalesce(v_second_selection ->> 'menuItemId', '')), '') is not null then
            begin
              v_menu_item_id := (v_second_selection ->> 'menuItemId')::uuid;
            exception when others then
              raise exception 'offeringAssignments[%].secondSelections[%].menuItemId must be uuid', v_idx, v_selection_idx - 1;
            end;

            if not exists (
              select 1
              from public.cheffing_menu_items mi
              where mi.id = v_menu_item_id
                and mi.menu_id = v_offering_row.cheffing_menu_id
            ) then
              raise exception 'offeringAssignments[%].secondSelections[%].menuItemId does not belong to selected menu', v_idx, v_selection_idx - 1;
            end if;

            if v_description is null then
              select nullif(trim(mi.notes), '') into v_description
              from public.cheffing_menu_items mi
              where mi.id = v_menu_item_id;
            end if;
          else
            v_menu_item_id := null;
          end if;

          if v_description is null then
            v_description := nullif(trim(coalesce(v_dish_notes, '')), '');
          end if;

          v_needs_doneness := coalesce(
            (v_second_selection ->> 'needsDonenessPoints')::boolean,
            position('entrecot' in lower(translate(v_dish_name, 'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñ', 'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'))) > 0,
            false
          );
        else
          v_dish_id := null;
          v_menu_item_id := null;
          v_display_name := nullif(trim(coalesce(v_second_selection ->> 'displayName', '')), '');
          if v_display_name is null then
            raise exception 'offeringAssignments[%].secondSelections[%].displayName is required for %', v_idx, v_selection_idx - 1, v_selection_kind;
          end if;
          v_description := nullif(trim(coalesce(v_second_selection ->> 'description', '')), '');
          v_needs_doneness := false;
        end if;

        insert into public.group_event_offering_selections (
          group_event_offering_id,
          selection_kind,
          cheffing_dish_id,
          cheffing_menu_item_id,
          display_name_snapshot,
          description_snapshot,
          quantity,
          notes,
          needs_doneness_points,
          sort_order,
          snapshot_payload
        )
        values (
          v_offering_row.id,
          v_selection_kind,
          v_dish_id,
          v_menu_item_id,
          v_display_name,
          v_description,
          v_quantity,
          v_selection_notes,
          v_needs_doneness,
          v_selection_sort_order,
          jsonb_build_object(
            'selection_kind', v_selection_kind,
            'dish_id', v_dish_id,
            'menu_item_id', v_menu_item_id,
            'payload', v_second_selection
          )
        )
        returning * into v_selection_row;

        if v_second_selection ? 'doneness' and coalesce(v_second_selection -> 'doneness', '[]'::jsonb) is not null then
          if jsonb_typeof(coalesce(v_second_selection -> 'doneness', '[]'::jsonb)) <> 'array' then
            raise exception 'offeringAssignments[%].secondSelections[%].doneness must be an array', v_idx, v_selection_idx - 1;
          end if;
        end if;

        if v_selection_kind <> 'menu_second' and coalesce(jsonb_array_length(coalesce(v_second_selection -> 'doneness', '[]'::jsonb)), 0) > 0 then
          raise exception 'offeringAssignments[%].secondSelections[%] only menu_second accepts doneness', v_idx, v_selection_idx - 1;
        end if;

        v_total_doneness := 0;
        for v_doneness, v_doneness_idx in
          select value, ordinality
          from jsonb_array_elements(coalesce(v_second_selection -> 'doneness', '[]'::jsonb)) with ordinality
        loop
          v_doneness_point := nullif(trim(coalesce(v_doneness ->> 'point', '')), '');
          if v_doneness_point not in ('crudo', 'poco', 'al_punto', 'hecho', 'muy_hecho') then
            raise exception 'offeringAssignments[%].secondSelections[%].doneness[%].point is invalid', v_idx, v_selection_idx - 1, v_doneness_idx - 1;
          end if;

          begin
            v_doneness_quantity_numeric := (v_doneness ->> 'quantity')::numeric;
          exception when others then
            raise exception 'offeringAssignments[%].secondSelections[%].doneness[%].quantity must be numeric', v_idx, v_selection_idx - 1, v_doneness_idx - 1;
          end;

          if v_doneness_quantity_numeric is null
            or v_doneness_quantity_numeric <> trunc(v_doneness_quantity_numeric)
            or v_doneness_quantity_numeric <= 0 then
            raise exception 'offeringAssignments[%].secondSelections[%].doneness[%].quantity must be a positive integer', v_idx, v_selection_idx - 1, v_doneness_idx - 1;
          end if;

          v_doneness_quantity := v_doneness_quantity_numeric::integer;
          v_total_doneness := v_total_doneness + v_doneness_quantity;

          insert into public.group_event_offering_selection_doneness (
            selection_id,
            point,
            quantity
          )
          values (
            v_selection_row.id,
            v_doneness_point,
            v_doneness_quantity
          );
        end loop;

        if v_total_doneness > 0 and v_total_doneness <> v_quantity then
          raise exception 'offeringAssignments[%].secondSelections[%].doneness total must match quantity', v_idx, v_selection_idx - 1;
        end if;
      end loop;
    end if;
  end loop;

  update public.group_events
  set menu_id = null,
      updated_at = timezone('utc', now())
  where id = p_group_event_id;

  perform public.rebuild_group_event_menu_text(p_group_event_id);
end;
$$;

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
