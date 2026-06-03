alter table public.external_reservation_settings
  add column if not exists default_room_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_reservation_settings_default_room_id_fkey'
      and conrelid = 'public.external_reservation_settings'::regclass
  ) then
    alter table public.external_reservation_settings
      add constraint external_reservation_settings_default_room_id_fkey
      foreign key (default_room_id) references public.rooms(id) on delete set null;
  end if;
end $$;

do $$
declare
  v_default_room_id uuid;
  v_medi_room_count integer;
begin
  select count(*)
    into v_medi_room_count
  from public.rooms as r
  where lower(r.name) = 'medi'
    and r.is_active is true;

  if v_medi_room_count = 1 then
    select r.id
      into v_default_room_id
    from public.rooms as r
    where lower(r.name) = 'medi'
      and r.is_active is true
    limit 1;

    insert into public.external_reservation_settings (
      id,
      default_room_id,
      is_enabled
    )
    values (
      true,
      v_default_room_id,
      false
    )
    on conflict (id) do update
      set default_room_id = coalesce(
        public.external_reservation_settings.default_room_id,
        excluded.default_room_id
      );
  else
    raise notice 'external_reservation_settings default_room_id left null because exactly one active room named "medi" was not found';
  end if;
end $$;
