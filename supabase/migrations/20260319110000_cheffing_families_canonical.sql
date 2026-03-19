-- Canonical families catalog for cheffing dishes.

create table if not exists public.cheffing_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_families_slug_unique'
  ) then
    alter table public.cheffing_families
      add constraint cheffing_families_slug_unique unique (slug);
  end if;
end $$;

create unique index if not exists cheffing_families_name_ci_unique
  on public.cheffing_families (lower(name));

create index if not exists cheffing_families_active_sort_idx
  on public.cheffing_families (is_active, sort_order, name);

alter table public.cheffing_dishes
  add column if not exists family_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_dishes_family_id_fkey'
  ) then
    alter table public.cheffing_dishes
      add constraint cheffing_dishes_family_id_fkey
      foreign key (family_id)
      references public.cheffing_families(id)
      on delete set null;
  end if;
end $$;

insert into public.cheffing_families (name, slug, sort_order)
values
  ('Amanidas', 'amanidas', 0),
  ('Arrebosats', 'arrebosats', 1),
  ('Carn', 'carn', 2),
  ('Carpaccio', 'carpaccio', 3),
  ('Coktails', 'coktails', 4),
  ('Combinats', 'combinats', 5),
  ('Entras freds', 'entras-freds', 6),
  ('Foodtruck', 'foodtruck', 7),
  ('Hamburgueseses', 'hamburgueseses', 8),
  ('Pasta / Arros', 'pasta-arros', 9),
  ('Patates', 'patates', 10),
  ('Peix', 'peix', 11),
  ('Postres', 'postres', 12),
  ('Refrescos', 'refrescos', 13),
  ('Refrescos Pub', 'refrescos-pub', 14),
  ('Saltejats', 'saltejats', 15),
  ('Snacks', 'snacks', 16)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

alter table public.cheffing_families enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cheffing_families'
      and policyname = 'cheffing_families_select'
  ) then
    create policy cheffing_families_select
      on public.cheffing_families
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cheffing_families'
      and policyname = 'cheffing_families_write'
  ) then
    create policy cheffing_families_write
      on public.cheffing_families
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;
end $$;

drop trigger if exists set_updated_at_cheffing_families on public.cheffing_families;
create trigger set_updated_at_cheffing_families
before update on public.cheffing_families
for each row
execute function public.tg_set_updated_at();
