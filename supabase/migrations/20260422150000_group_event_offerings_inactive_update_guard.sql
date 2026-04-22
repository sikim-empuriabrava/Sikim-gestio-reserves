create or replace function public.sync_group_event_cheffing_menu_offerings(
  p_group_event_id uuid,
  p_menu_assignments jsonb,
  p_allow_existing_inactive boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_assignment jsonb;
  v_idx bigint;
  v_menu_id_text text;
  v_menu_id uuid;
  v_assigned_pax_numeric numeric;
  v_assigned_pax integer;
  v_sort_order integer;
  v_notes text;
begin
  if p_menu_assignments is null then
    return;
  end if;

  if jsonb_typeof(p_menu_assignments) <> 'array' then
    raise exception 'menuAssignments must be an array';
  end if;

  create temporary table if not exists _tmp_menu_assignments (
    menu_id uuid not null,
    assigned_pax integer not null,
    sort_order integer not null,
    notes text null
  ) on commit drop;

  truncate table _tmp_menu_assignments;

  for v_assignment, v_idx in
    select value, ordinality
    from jsonb_array_elements(p_menu_assignments) with ordinality
  loop
    v_menu_id_text := nullif(trim(v_assignment ->> 'menuId'), '');
    if v_menu_id_text is null then
      raise exception 'menuAssignments[%].menuId is required', v_idx - 1;
    end if;

    begin
      v_menu_id := v_menu_id_text::uuid;
    exception when others then
      raise exception 'menuAssignments[%].menuId must be uuid', v_idx - 1;
    end;

    begin
      v_assigned_pax_numeric := (v_assignment ->> 'assignedPax')::numeric;
    exception when others then
      raise exception 'menuAssignments[%].assignedPax must be numeric', v_idx - 1;
    end;

    if v_assigned_pax_numeric is null
      or v_assigned_pax_numeric <> trunc(v_assigned_pax_numeric)
      or v_assigned_pax_numeric <= 0 then
      raise exception 'menuAssignments[%].assignedPax must be a positive integer', v_idx - 1;
    end if;

    v_assigned_pax := v_assigned_pax_numeric::integer;

    if v_assignment ? 'sortOrder' and v_assignment ->> 'sortOrder' is not null then
      begin
        v_sort_order := (v_assignment ->> 'sortOrder')::integer;
      exception when others then
        raise exception 'menuAssignments[%].sortOrder must be an integer', v_idx - 1;
      end;
    else
      v_sort_order := (v_idx - 1)::integer;
    end if;

    v_notes := nullif(trim(coalesce(v_assignment ->> 'notes', '')), '');

    insert into _tmp_menu_assignments (menu_id, assigned_pax, sort_order, notes)
    values (v_menu_id, v_assigned_pax, v_sort_order, v_notes);
  end loop;

  if exists (
    select 1
    from _tmp_menu_assignments t
    left join public.cheffing_menus m on m.id = t.menu_id
    where m.id is null
  ) then
    raise exception 'menuAssignments contains unknown menuId';
  end if;

  if p_allow_existing_inactive then
    if exists (
      select 1
      from _tmp_menu_assignments t
      join public.cheffing_menus m on m.id = t.menu_id
      left join public.group_event_offerings offered
        on offered.group_event_id = p_group_event_id
       and offered.offering_kind = 'cheffing_menu'
       and offered.cheffing_menu_id = t.menu_id
      where m.is_active is not true
        and offered.id is null
    ) then
      raise exception 'menuAssignments contains inactive cheffing menu not already linked to this reservation';
    end if;
  else
    if exists (
      select 1
      from _tmp_menu_assignments t
      join public.cheffing_menus m on m.id = t.menu_id
      where m.is_active is not true
    ) then
      raise exception 'menuAssignments contains inactive cheffing menu';
    end if;
  end if;

  delete from public.group_event_offerings
  where group_event_id = p_group_event_id
    and offering_kind = 'cheffing_menu';

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
    t.menu_id,
    null,
    t.assigned_pax,
    m.name,
    m.price_per_person,
    t.notes,
    t.sort_order,
    jsonb_build_object(
      'source_kind', 'cheffing_menu',
      'source_menu_id', m.id,
      'source_menu_name', m.name,
      'source_price_per_person', m.price_per_person
    )
  from _tmp_menu_assignments t
  join public.cheffing_menus m on m.id = t.menu_id
  order by t.sort_order, t.menu_id;

  update public.group_events
  set menu_id = null,
      updated_at = timezone('utc', now())
  where id = p_group_event_id;

  perform public.rebuild_group_event_menu_text(p_group_event_id);
end;
$$;

create or replace function public.create_group_event_with_cheffing_offerings(
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_event_id uuid;
  v_name text;
  v_event_date date;
  v_entry_time time;
  v_adults integer;
  v_children integer := 0;
  v_allergens_and_diets text;
  v_setup_notes text;
  v_extras text;
  v_menu_text text;
  v_second_course_type text;
  v_room_id uuid;
  v_override_capacity boolean := false;
  v_notes text;
  v_status text := 'confirmed';
begin
  if p_payload is null then
    raise exception 'Missing payload';
  end if;

  v_name := nullif(trim(coalesce(p_payload ->> 'name', '')), '');
  if v_name is null then
    raise exception 'Missing required field: name';
  end if;

  begin
    v_event_date := (p_payload ->> 'event_date')::date;
  exception when others then
    raise exception 'Invalid or missing event_date';
  end;

  begin
    v_adults := (p_payload ->> 'adults')::integer;
  exception when others then
    raise exception 'Invalid or missing adults';
  end;

  if v_adults is null then
    raise exception 'Invalid or missing adults';
  end if;

  if p_payload ? 'children' and p_payload ->> 'children' is not null then
    begin
      v_children := (p_payload ->> 'children')::integer;
    exception when others then
      raise exception 'children must be integer';
    end;
  end if;

  if p_payload ? 'entry_time' and p_payload ->> 'entry_time' is not null and trim(p_payload ->> 'entry_time') <> '' then
    begin
      v_entry_time := (p_payload ->> 'entry_time')::time;
    exception when others then
      raise exception 'entry_time must be a valid time';
    end;
  else
    v_entry_time := null;
  end if;

  v_allergens_and_diets := nullif(trim(coalesce(p_payload ->> 'allergens_and_diets', '')), '');
  v_setup_notes := nullif(trim(coalesce(p_payload ->> 'setup_notes', '')), '');
  v_extras := nullif(trim(coalesce(p_payload ->> 'extras', '')), '');
  v_menu_text := nullif(trim(coalesce(p_payload ->> 'menu_text', '')), '');
  v_second_course_type := nullif(trim(coalesce(p_payload ->> 'second_course_type', '')), '');
  v_notes := nullif(trim(coalesce(p_payload ->> 'notes', '')), '');

  if p_payload ? 'status' and p_payload ->> 'status' is not null and trim(p_payload ->> 'status') <> '' then
    v_status := trim(p_payload ->> 'status');
  end if;

  begin
    v_room_id := (p_payload ->> 'room_id')::uuid;
  exception when others then
    raise exception 'Invalid or missing room_id';
  end;

  if p_payload ? 'override_capacity' and p_payload ->> 'override_capacity' is not null then
    begin
      v_override_capacity := (p_payload ->> 'override_capacity')::boolean;
    exception when others then
      raise exception 'override_capacity must be boolean';
    end;
  end if;

  insert into public.group_events (
    name,
    event_date,
    entry_time,
    adults,
    children,
    has_private_dining_room,
    has_private_party,
    second_course_type,
    menu_text,
    allergens_and_diets,
    extras,
    setup_notes,
    deposit_amount,
    deposit_status,
    invoice_data,
    status
  )
  values (
    v_name,
    v_event_date,
    v_entry_time,
    v_adults,
    coalesce(v_children, 0),
    false,
    false,
    v_second_course_type,
    v_menu_text,
    v_allergens_and_diets,
    v_extras,
    v_setup_notes,
    null,
    null,
    null,
    v_status
  )
  returning id into v_group_event_id;

  insert into public.group_room_allocations (
    group_event_id,
    room_id,
    adults,
    children,
    override_capacity,
    notes
  )
  values (
    v_group_event_id,
    v_room_id,
    v_adults,
    coalesce(v_children, 0),
    coalesce(v_override_capacity, false),
    v_notes
  );

  if p_payload ? 'menuAssignments' then
    perform public.sync_group_event_cheffing_menu_offerings(
      v_group_event_id,
      p_payload -> 'menuAssignments',
      false
    );
  end if;

  return v_group_event_id;
end;
$$;

create or replace function public.update_group_event_with_cheffing_offerings(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_event_id uuid;
  v_current public.group_events;
  v_name text;
  v_event_date date;
  v_entry_time time;
  v_adults integer;
  v_children integer;
  v_has_private_dining_room boolean;
  v_has_private_party boolean;
  v_second_course_type text;
  v_menu_text text;
  v_allergens_and_diets text;
  v_extras text;
  v_setup_notes text;
  v_invoice_data text;
  v_deposit_amount numeric(10,2);
  v_deposit_status text;
  v_status text;
begin
  if p_payload is null then
    raise exception 'Missing payload';
  end if;

  begin
    v_group_event_id := (p_payload ->> 'id')::uuid;
  exception when others then
    raise exception 'Missing or invalid id';
  end;

  select *
  into v_current
  from public.group_events
  where id = v_group_event_id
  for update;

  if not found then
    raise exception 'group event not found';
  end if;

  v_name := case when p_payload ? 'name'
    then coalesce(nullif(trim(p_payload ->> 'name'), ''), v_current.name)
    else v_current.name end;

  begin
    v_event_date := case when p_payload ? 'event_date'
      then (p_payload ->> 'event_date')::date
      else v_current.event_date end;
  exception when others then
    raise exception 'Invalid event_date';
  end;

  begin
    if p_payload ? 'entry_time' then
      if p_payload ->> 'entry_time' is null or trim(p_payload ->> 'entry_time') = '' then
        v_entry_time := null;
      else
        v_entry_time := (p_payload ->> 'entry_time')::time;
      end if;
    else
      v_entry_time := v_current.entry_time;
    end if;
  exception when others then
    raise exception 'Invalid entry_time';
  end;

  begin
    v_adults := case when p_payload ? 'adults' then (p_payload ->> 'adults')::integer else v_current.adults end;
  exception when others then
    raise exception 'Invalid adults';
  end;

  begin
    v_children := case when p_payload ? 'children' then (p_payload ->> 'children')::integer else v_current.children end;
  exception when others then
    raise exception 'Invalid children';
  end;

  begin
    v_has_private_dining_room := case when p_payload ? 'has_private_dining_room'
      then (p_payload ->> 'has_private_dining_room')::boolean
      else v_current.has_private_dining_room end;
  exception when others then
    raise exception 'Invalid has_private_dining_room';
  end;

  begin
    v_has_private_party := case when p_payload ? 'has_private_party'
      then (p_payload ->> 'has_private_party')::boolean
      else v_current.has_private_party end;
  exception when others then
    raise exception 'Invalid has_private_party';
  end;

  v_second_course_type := case when p_payload ? 'second_course_type'
    then nullif(trim(coalesce(p_payload ->> 'second_course_type', '')), '')
    else v_current.second_course_type end;

  v_menu_text := case when p_payload ? 'menu_text'
    then nullif(trim(coalesce(p_payload ->> 'menu_text', '')), '')
    else v_current.menu_text end;

  v_allergens_and_diets := case when p_payload ? 'allergens_and_diets'
    then nullif(trim(coalesce(p_payload ->> 'allergens_and_diets', '')), '')
    else v_current.allergens_and_diets end;

  v_extras := case when p_payload ? 'extras'
    then nullif(trim(coalesce(p_payload ->> 'extras', '')), '')
    else v_current.extras end;

  v_setup_notes := case when p_payload ? 'setup_notes'
    then nullif(trim(coalesce(p_payload ->> 'setup_notes', '')), '')
    else v_current.setup_notes end;

  v_invoice_data := case when p_payload ? 'invoice_data'
    then nullif(trim(coalesce(p_payload ->> 'invoice_data', '')), '')
    else v_current.invoice_data end;

  begin
    v_deposit_amount := case when p_payload ? 'deposit_amount'
      then nullif(trim(coalesce(p_payload ->> 'deposit_amount', '')), '')::numeric(10,2)
      else v_current.deposit_amount end;
  exception when others then
    raise exception 'Invalid deposit_amount';
  end;

  v_deposit_status := case when p_payload ? 'deposit_status'
    then nullif(trim(coalesce(p_payload ->> 'deposit_status', '')), '')
    else v_current.deposit_status end;

  v_status := case when p_payload ? 'status'
    then trim(coalesce(p_payload ->> 'status', ''))
    else v_current.status end;

  if v_status = '' then
    v_status := v_current.status;
  end if;

  update public.group_events
  set
    name = v_name,
    event_date = v_event_date,
    entry_time = v_entry_time,
    adults = v_adults,
    children = v_children,
    has_private_dining_room = v_has_private_dining_room,
    has_private_party = v_has_private_party,
    second_course_type = v_second_course_type,
    menu_text = v_menu_text,
    allergens_and_diets = v_allergens_and_diets,
    extras = v_extras,
    setup_notes = v_setup_notes,
    invoice_data = v_invoice_data,
    deposit_amount = v_deposit_amount,
    deposit_status = v_deposit_status,
    status = v_status,
    updated_at = timezone('utc', now())
  where id = v_group_event_id;

  if p_payload ? 'menuAssignments' then
    perform public.sync_group_event_cheffing_menu_offerings(
      v_group_event_id,
      p_payload -> 'menuAssignments',
      true
    );
  end if;

  return jsonb_build_object('success', true, 'groupEventId', v_group_event_id);
end;
$$;
