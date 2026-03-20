-- Cheffing consumer entities: menus and cards (carta).

create table if not exists public.cheffing_menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text null,
  price_per_person numeric null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cheffing_menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.cheffing_menus(id) on delete cascade,
  dish_id uuid not null references public.cheffing_dishes(id) on delete restrict,
  multiplier numeric not null default 1,
  sort_order integer not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cheffing_menu_items_multiplier_positive check (multiplier > 0)
);

create index if not exists cheffing_menu_items_menu_sort_idx
  on public.cheffing_menu_items (menu_id, sort_order);

create index if not exists cheffing_menu_items_dish_id_idx
  on public.cheffing_menu_items (dish_id);

create table if not exists public.cheffing_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cheffing_card_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cheffing_cards(id) on delete cascade,
  dish_id uuid not null references public.cheffing_dishes(id) on delete restrict,
  multiplier numeric not null default 1,
  sort_order integer not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cheffing_card_items_multiplier_positive check (multiplier > 0)
);

create index if not exists cheffing_card_items_card_sort_idx
  on public.cheffing_card_items (card_id, sort_order);

create index if not exists cheffing_card_items_dish_id_idx
  on public.cheffing_card_items (dish_id);

alter table public.cheffing_menus enable row level security;
alter table public.cheffing_menu_items enable row level security;
alter table public.cheffing_cards enable row level security;
alter table public.cheffing_card_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cheffing_menus' and policyname = 'cheffing_menus_select'
  ) then
    create policy cheffing_menus_select
      on public.cheffing_menus
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cheffing_menus' and policyname = 'cheffing_menus_write'
  ) then
    create policy cheffing_menus_write
      on public.cheffing_menus
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cheffing_menu_items' and policyname = 'cheffing_menu_items_select'
  ) then
    create policy cheffing_menu_items_select
      on public.cheffing_menu_items
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cheffing_menu_items' and policyname = 'cheffing_menu_items_write'
  ) then
    create policy cheffing_menu_items_write
      on public.cheffing_menu_items
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cheffing_cards' and policyname = 'cheffing_cards_select'
  ) then
    create policy cheffing_cards_select
      on public.cheffing_cards
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cheffing_cards' and policyname = 'cheffing_cards_write'
  ) then
    create policy cheffing_cards_write
      on public.cheffing_cards
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cheffing_card_items' and policyname = 'cheffing_card_items_select'
  ) then
    create policy cheffing_card_items_select
      on public.cheffing_card_items
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cheffing_card_items' and policyname = 'cheffing_card_items_write'
  ) then
    create policy cheffing_card_items_write
      on public.cheffing_card_items
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;
end $$;

drop trigger if exists set_updated_at_cheffing_menus on public.cheffing_menus;
create trigger set_updated_at_cheffing_menus
before update on public.cheffing_menus
for each row
execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_cheffing_menu_items on public.cheffing_menu_items;
create trigger set_updated_at_cheffing_menu_items
before update on public.cheffing_menu_items
for each row
execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_cheffing_cards on public.cheffing_cards;
create trigger set_updated_at_cheffing_cards
before update on public.cheffing_cards
for each row
execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_cheffing_card_items on public.cheffing_card_items;
create trigger set_updated_at_cheffing_card_items
before update on public.cheffing_card_items
for each row
execute function public.tg_set_updated_at();
