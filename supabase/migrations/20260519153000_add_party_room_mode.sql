do $$
begin
  if not exists (
    select 1
    from public.rooms
    where lower(name) = 'pub'
  ) then
    insert into public.rooms (
      name,
      capacity_seated,
      capacity_standing,
      sort_order,
      is_active
    )
    values ('Pub', 80, 120, 900, true);
  end if;

  if not exists (
    select 1
    from public.rooms
    where lower(name) = 'disco'
  ) then
    insert into public.rooms (
      name,
      capacity_seated,
      capacity_standing,
      sort_order,
      is_active
    )
    values ('Disco', 250, 350, 910, true);
  end if;
end $$;

alter table public.group_events
  add column if not exists party_room_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_events_party_room_id_fkey'
      and conrelid = 'public.group_events'::regclass
  ) then
    alter table public.group_events
      add constraint group_events_party_room_id_fkey
      foreign key (party_room_id) references public.rooms(id);
  end if;
end $$;

create index if not exists group_events_party_room_id_idx
  on public.group_events (party_room_id);

alter table public.group_events
  drop constraint if exists group_events_event_mode_chk;

alter table public.group_events
  add constraint group_events_event_mode_chk
  check (event_mode in ('dinner', 'dinner_private_party', 'private_party_only'));

create or replace function public.create_group_event_with_cheffing_offerings(
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_event_id uuid;
  v_name text;
  v_event_date date;
  v_entry_time time;
  v_adults integer;
  v_children integer := 0;
  v_event_mode text := 'dinner';
  v_party_room_id uuid;
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

  v_event_mode := nullif(trim(coalesce(p_payload ->> 'event_mode', 'dinner')), '');
  if v_event_mode is null then
    v_event_mode := 'dinner';
  end if;

  if v_event_mode not in ('dinner', 'dinner_private_party', 'private_party_only') then
    raise exception 'Invalid event_mode';
  end if;

  v_allergens_and_diets := nullif(trim(coalesce(p_payload ->> 'allergens_and_diets', '')), '');
  v_setup_notes := nullif(trim(coalesce(p_payload ->> 'setup_notes', '')), '');
  v_extras := nullif(trim(coalesce(p_payload ->> 'extras', '')), '');
  v_menu_text := nullif(trim(coalesce(p_payload ->> 'menu_text', '')), '');
  v_second_course_type := nullif(trim(coalesce(p_payload ->> 'second_course_type', '')), '');
  v_notes := nullif(trim(coalesce(p_payload ->> 'notes', '')), '');

  if v_event_mode in ('dinner_private_party', 'private_party_only') then
    begin
      v_party_room_id := (p_payload ->> 'party_room_id')::uuid;
    exception when others then
      raise exception 'Invalid or missing party_room_id';
    end;

    if not exists (
      select 1
      from public.rooms
      where id = v_party_room_id
        and lower(name) in ('pub', 'disco')
    ) then
      raise exception 'party_room_id must be Pub or Disco';
    end if;
  else
    v_party_room_id := null;
  end if;

  if v_event_mode = 'private_party_only' then
    v_menu_text := null;
    v_second_course_type := null;
    v_allergens_and_diets := null;
    v_extras := null;
  else
    begin
      v_room_id := (p_payload ->> 'room_id')::uuid;
    exception when others then
      raise exception 'Invalid or missing room_id';
    end;

    if not exists (
      select 1
      from public.rooms
      where id = v_room_id
        and lower(name) not in ('pub', 'disco')
    ) then
      raise exception 'room_id must be a dinner room';
    end if;
  end if;

  if p_payload ? 'status' and p_payload ->> 'status' is not null and trim(p_payload ->> 'status') <> '' then
    v_status := trim(p_payload ->> 'status');
  end if;

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
    event_mode,
    party_room_id,
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
    v_event_mode,
    v_party_room_id,
    false,
    v_event_mode in ('dinner_private_party', 'private_party_only'),
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

  if v_event_mode <> 'private_party_only' then
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

    if p_payload ? 'offeringAssignments' then
      perform public.sync_group_event_offerings(
        v_group_event_id,
        p_payload -> 'offeringAssignments',
        false
      );
    elsif p_payload ? 'menuAssignments' then
      perform public.sync_group_event_cheffing_menu_offerings(
        v_group_event_id,
        p_payload -> 'menuAssignments',
        false
      );
    end if;
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
set search_path = public, pg_temp
as $$
declare
  v_group_event_id uuid;
  v_current public.group_events;
  v_name text;
  v_event_date date;
  v_entry_time time;
  v_adults integer;
  v_children integer;
  v_event_mode text;
  v_party_room_id uuid;
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

  v_event_mode := case when p_payload ? 'event_mode'
    then nullif(trim(coalesce(p_payload ->> 'event_mode', '')), '')
    else coalesce(v_current.event_mode, 'dinner') end;

  if v_event_mode is null then
    v_event_mode := 'dinner';
  end if;

  if v_event_mode not in ('dinner', 'dinner_private_party', 'private_party_only') then
    raise exception 'Invalid event_mode';
  end if;

  if v_event_mode in ('dinner_private_party', 'private_party_only') then
    begin
      v_party_room_id := (p_payload ->> 'party_room_id')::uuid;
    exception when others then
      raise exception 'Invalid or missing party_room_id';
    end;

    if not exists (
      select 1
      from public.rooms
      where id = v_party_room_id
        and lower(name) in ('pub', 'disco')
    ) then
      raise exception 'party_room_id must be Pub or Disco';
    end if;
  else
    v_party_room_id := null;
  end if;

  begin
    v_has_private_dining_room := case when p_payload ? 'has_private_dining_room'
      then (p_payload ->> 'has_private_dining_room')::boolean
      else v_current.has_private_dining_room end;
  exception when others then
    raise exception 'Invalid has_private_dining_room';
  end;

  v_has_private_party := v_event_mode in ('dinner_private_party', 'private_party_only');

  if v_event_mode = 'private_party_only' then
    v_has_private_dining_room := false;
  end if;

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

  if v_event_mode = 'private_party_only' then
    v_menu_text := null;
    v_second_course_type := null;
    v_allergens_and_diets := null;
    v_extras := null;
  end if;

  update public.group_events
  set
    name = v_name,
    event_date = v_event_date,
    entry_time = v_entry_time,
    adults = v_adults,
    children = v_children,
    event_mode = v_event_mode,
    party_room_id = v_party_room_id,
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

  if v_event_mode = 'private_party_only' then
    delete from public.group_room_allocations
    where group_event_id = v_group_event_id;

    perform public.sync_group_event_offerings(
      v_group_event_id,
      '[]'::jsonb,
      true
    );
  elsif p_payload ? 'offeringAssignments' then
    perform public.sync_group_event_offerings(
      v_group_event_id,
      p_payload -> 'offeringAssignments',
      true
    );
  elsif p_payload ? 'menuAssignments' then
    perform public.sync_group_event_cheffing_menu_offerings(
      v_group_event_id,
      p_payload -> 'menuAssignments',
      true
    );
  end if;

  return jsonb_build_object('success', true, 'groupEventId', v_group_event_id);
end;
$$;

create or replace view public.v_group_events_calendar_sync
with (security_invoker = true) as
 select ge.id as group_event_id,
    ge.event_date,
    ge.entry_time,
    ge.name as group_name,
    ge.total_pax,
    ge.status,
    ge.calendar_event_id,
        case
            when ((ge.status = any (array['draft'::text, 'pending'::text, 'cancelled'::text])) and (ge.calendar_event_id is not null)) then 'delete'::text
            when ge.calendar_deleted_externally then 'noop'::text
            when ((ge.status = any (array['confirmed'::text, 'completed'::text])) and (ge.calendar_event_id is null)) then 'create'::text
            when ((ge.status = any (array['confirmed'::text, 'completed'::text])) and (ge.calendar_event_id is not null)) then 'update'::text
            else 'noop'::text
        end as desired_calendar_action,
        case
            when ((ge.status = any (array['draft'::text, 'pending'::text, 'cancelled'::text])) and (ge.calendar_event_id is not null)) then true
            when ge.calendar_deleted_externally then false
            when ((ge.status = any (array['confirmed'::text, 'completed'::text])) and (ge.calendar_event_id is null)) then true
            when ((ge.status = any (array['confirmed'::text, 'completed'::text])) and (ge.calendar_event_id is not null)) then true
            else false
        end as needs_calendar_sync,
    ge.calendar_deleted_externally,
    ge.event_mode,
    ge.party_room_id,
    pr.name as party_room_name
   from public.group_events ge
     left join public.rooms pr on pr.id = ge.party_room_id;

create or replace view public.v_group_events_daily_detail
with (security_invoker = true) as
 select ge.event_date,
    ge.entry_time,
    ge.id as group_event_id,
    ge.name as group_name,
    ge.status,
    ge.total_pax,
    ge.has_private_dining_room,
    ge.has_private_party,
    r.id as room_id,
    r.name as room_name,
    pr.id as party_room_id,
    pr.name as party_room_name,
    gra.total_pax as room_total_pax,
    gra.override_capacity as room_override_capacity,
    gsp.recommended_waiters,
    gsp.recommended_runners,
    gsp.recommended_bartenders,
    ge.adults,
    ge.children,
    ge.second_course_type,
    ge.menu_text,
    ge.allergens_and_diets,
    ge.extras,
    ge.setup_notes,
    ge.invoice_data,
    ge.service_outcome,
    ge.service_outcome_notes,
    ge.event_mode
   from ((((public.group_events ge
     left join public.group_room_allocations gra on ((gra.group_event_id = ge.id)))
     left join public.rooms r on ((r.id = gra.room_id)))
     left join public.rooms pr on ((pr.id = ge.party_room_id)))
     left join public.group_staffing_plans gsp on ((gsp.group_event_id = ge.id)))
  where (ge.status <> 'cancelled'::text);
