create table if not exists public.external_reservation_settings (
  id boolean primary key default true,
  default_offering_kind text null,
  default_cheffing_card_id uuid null references public.cheffing_cards(id) on delete set null,
  default_cheffing_menu_id uuid null references public.cheffing_menus(id) on delete set null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_reservation_settings_singleton_chk
    check (id = true),
  constraint external_reservation_settings_default_offering_kind_check
    check (
      default_offering_kind is null
      or default_offering_kind in ('cheffing_card', 'cheffing_menu')
    ),
  constraint external_reservation_settings_default_offering_reference_consistency_chk
    check (
      (
        default_offering_kind is null
        and default_cheffing_card_id is null
        and default_cheffing_menu_id is null
      )
      or (
        default_offering_kind = 'cheffing_card'
        and default_cheffing_card_id is not null
        and default_cheffing_menu_id is null
      )
      or (
        default_offering_kind = 'cheffing_menu'
        and default_cheffing_menu_id is not null
        and default_cheffing_card_id is null
      )
    )
);

create or replace function public.normalize_external_reservation_settings_default_offering()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.default_offering_kind in ('cheffing_card', 'cheffing_menu')
     and new.default_cheffing_card_id is null
     and new.default_cheffing_menu_id is null then
    new.default_offering_kind := null;
  end if;

  if new.default_offering_kind is null
     and new.default_cheffing_card_id is null
     and new.default_cheffing_menu_id is null then
    new.is_enabled := false;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_external_reservation_settings_default_offering
  on public.external_reservation_settings;
create trigger normalize_external_reservation_settings_default_offering
before insert or update on public.external_reservation_settings
for each row
execute function public.normalize_external_reservation_settings_default_offering();

drop trigger if exists set_updated_at_external_reservation_settings on public.external_reservation_settings;
create trigger set_updated_at_external_reservation_settings
before update on public.external_reservation_settings
for each row
execute function public.tg_set_updated_at();

alter table public.external_reservation_settings enable row level security;

revoke all on table public.external_reservation_settings from anon, authenticated;
grant all on table public.external_reservation_settings to service_role;

do $$
declare
  v_default_card_id uuid;
begin
  select c.id
    into v_default_card_id
  from public.cheffing_cards as c
  where c.name = 'Carta Plats'
    and c.is_active is true
  order by c.created_at, c.id
  limit 1;

  insert into public.external_reservation_settings (
    id,
    default_offering_kind,
    default_cheffing_card_id,
    default_cheffing_menu_id,
    is_enabled
  )
  values (
    true,
    case when v_default_card_id is not null then 'cheffing_card' else null end,
    v_default_card_id,
    null,
    case when v_default_card_id is not null then true else false end
  )
  on conflict (id) do nothing;

  if v_default_card_id is null then
    raise notice 'external_reservation_settings seeded disabled because active card "Carta Plats" was not found';
  end if;
end;
$$;
