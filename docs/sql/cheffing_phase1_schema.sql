-- Cheffing Phase 1 schema

create table if not exists public.cheffing_units (
  code text primary key,
  name text,
  dimension text not null check (dimension in ('mass', 'volume', 'unit')),
  to_base_factor numeric not null check (to_base_factor > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cheffing_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purchase_unit_code text not null references public.cheffing_units (code),
  purchase_pack_qty numeric not null check (purchase_pack_qty > 0),
  purchase_price numeric not null check (purchase_price >= 0),
  waste_pct numeric not null default 0 check (waste_pct >= 0 and waste_pct <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cheffing_subrecipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  output_unit_code text not null references public.cheffing_units (code),
  output_qty numeric not null check (output_qty > 0),
  waste_pct numeric not null default 0 check (waste_pct >= 0 and waste_pct <= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cheffing_subrecipe_items (
  id uuid primary key default gen_random_uuid(),
  subrecipe_id uuid not null references public.cheffing_subrecipes (id) on delete cascade,
  ingredient_id uuid references public.cheffing_ingredients (id),
  subrecipe_component_id uuid references public.cheffing_subrecipes (id),
  unit_code text not null references public.cheffing_units (code),
  quantity numeric not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cheffing_subrecipe_items_component_check
    check ((ingredient_id is null) <> (subrecipe_component_id is null))
);

create table if not exists public.cheffing_dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  selling_price numeric check (selling_price is null or selling_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cheffing_dish_items (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.cheffing_dishes (id) on delete cascade,
  ingredient_id uuid references public.cheffing_ingredients (id),
  subrecipe_id uuid references public.cheffing_subrecipes (id),
  unit_code text not null references public.cheffing_units (code),
  quantity numeric not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cheffing_dish_items_component_check
    check ((ingredient_id is null) <> (subrecipe_id is null))
);

create or replace function public.cheffing_is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_allowed_users
    where is_active = true
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (role = 'admin' or can_cheffing = true)
  );
$$;

alter table public.cheffing_units enable row level security;
alter table public.cheffing_ingredients enable row level security;
alter table public.cheffing_subrecipes enable row level security;
alter table public.cheffing_subrecipe_items enable row level security;
alter table public.cheffing_dishes enable row level security;
alter table public.cheffing_dish_items enable row level security;

create policy cheffing_units_select on public.cheffing_units
  for select using (public.cheffing_is_allowed());
create policy cheffing_units_insert on public.cheffing_units
  for insert with check (public.cheffing_is_allowed());
create policy cheffing_units_update on public.cheffing_units
  for update using (public.cheffing_is_allowed()) with check (public.cheffing_is_allowed());
create policy cheffing_units_delete on public.cheffing_units
  for delete using (public.cheffing_is_allowed());

create policy cheffing_ingredients_select on public.cheffing_ingredients
  for select using (public.cheffing_is_allowed());
create policy cheffing_ingredients_insert on public.cheffing_ingredients
  for insert with check (public.cheffing_is_allowed());
create policy cheffing_ingredients_update on public.cheffing_ingredients
  for update using (public.cheffing_is_allowed()) with check (public.cheffing_is_allowed());
create policy cheffing_ingredients_delete on public.cheffing_ingredients
  for delete using (public.cheffing_is_allowed());

create policy cheffing_subrecipes_select on public.cheffing_subrecipes
  for select using (public.cheffing_is_allowed());
create policy cheffing_subrecipes_insert on public.cheffing_subrecipes
  for insert with check (public.cheffing_is_allowed());
create policy cheffing_subrecipes_update on public.cheffing_subrecipes
  for update using (public.cheffing_is_allowed()) with check (public.cheffing_is_allowed());
create policy cheffing_subrecipes_delete on public.cheffing_subrecipes
  for delete using (public.cheffing_is_allowed());

create policy cheffing_subrecipe_items_select on public.cheffing_subrecipe_items
  for select using (public.cheffing_is_allowed());
create policy cheffing_subrecipe_items_insert on public.cheffing_subrecipe_items
  for insert with check (public.cheffing_is_allowed());
create policy cheffing_subrecipe_items_update on public.cheffing_subrecipe_items
  for update using (public.cheffing_is_allowed()) with check (public.cheffing_is_allowed());
create policy cheffing_subrecipe_items_delete on public.cheffing_subrecipe_items
  for delete using (public.cheffing_is_allowed());

create policy cheffing_dishes_select on public.cheffing_dishes
  for select using (public.cheffing_is_allowed());
create policy cheffing_dishes_insert on public.cheffing_dishes
  for insert with check (public.cheffing_is_allowed());
create policy cheffing_dishes_update on public.cheffing_dishes
  for update using (public.cheffing_is_allowed()) with check (public.cheffing_is_allowed());
create policy cheffing_dishes_delete on public.cheffing_dishes
  for delete using (public.cheffing_is_allowed());

create policy cheffing_dish_items_select on public.cheffing_dish_items
  for select using (public.cheffing_is_allowed());
create policy cheffing_dish_items_insert on public.cheffing_dish_items
  for insert with check (public.cheffing_is_allowed());
create policy cheffing_dish_items_update on public.cheffing_dish_items
  for update using (public.cheffing_is_allowed()) with check (public.cheffing_is_allowed());
create policy cheffing_dish_items_delete on public.cheffing_dish_items
  for delete using (public.cheffing_is_allowed());

create or replace view public.v_cheffing_ingredients_cost as
select
  i.id,
  i.name,
  i.purchase_unit_code,
  i.purchase_pack_qty,
  i.purchase_price,
  i.waste_pct,
  i.created_at,
  i.updated_at,
  u.dimension as purchase_unit_dimension,
  u.to_base_factor as purchase_unit_factor,
  (i.purchase_price / nullif(i.purchase_pack_qty * u.to_base_factor, 0)) as cost_gross_per_base,
  (i.purchase_price / nullif(i.purchase_pack_qty * u.to_base_factor, 0)) / nullif(1 - i.waste_pct, 0) as cost_net_per_base,
  1 / nullif(1 - i.waste_pct, 0) as waste_factor
from public.cheffing_ingredients i
join public.cheffing_units u on u.code = i.purchase_unit_code;

create or replace view public.v_cheffing_subrecipe_cost as
with item_costs as (
  select
    s.id as subrecipe_id,
    sum(
      case
        when si.ingredient_id is not null
          and u_item.dimension = vic.purchase_unit_dimension
          then vic.cost_net_per_base * (si.quantity * u_item.to_base_factor)
        else null
      end
    ) as items_cost_total
  from public.cheffing_subrecipes s
  left join public.cheffing_subrecipe_items si on si.subrecipe_id = s.id
  left join public.v_cheffing_ingredients_cost vic on vic.id = si.ingredient_id
  left join public.cheffing_units u_item on u_item.code = si.unit_code
  group by s.id
)
select
  s.id,
  s.name,
  s.output_unit_code,
  s.output_qty,
  s.waste_pct,
  s.created_at,
  s.updated_at,
  u.dimension as output_unit_dimension,
  u.to_base_factor as output_unit_factor,
  ic.items_cost_total,
  (ic.items_cost_total / nullif(s.output_qty * u.to_base_factor, 0)) as cost_gross_per_base,
  (ic.items_cost_total / nullif(s.output_qty * u.to_base_factor, 0)) / nullif(1 - s.waste_pct, 0) as cost_net_per_base,
  1 / nullif(1 - s.waste_pct, 0) as waste_factor
from public.cheffing_subrecipes s
join public.cheffing_units u on u.code = s.output_unit_code
left join item_costs ic on ic.subrecipe_id = s.id;

create or replace view public.v_cheffing_dish_cost as
with item_costs as (
  select
    d.id as dish_id,
    sum(
      case
        when di.ingredient_id is not null
          and u_item.dimension = vic.purchase_unit_dimension
          then vic.cost_net_per_base * (di.quantity * u_item.to_base_factor)
        when di.subrecipe_id is not null
          and u_item.dimension = vsc.output_unit_dimension
          then vsc.cost_net_per_base * (di.quantity * u_item.to_base_factor)
        else null
      end
    ) as items_cost_total
  from public.cheffing_dishes d
  left join public.cheffing_dish_items di on di.dish_id = d.id
  left join public.v_cheffing_ingredients_cost vic on vic.id = di.ingredient_id
  left join public.v_cheffing_subrecipe_cost vsc on vsc.id = di.subrecipe_id
  left join public.cheffing_units u_item on u_item.code = di.unit_code
  group by d.id
)
select
  d.id,
  d.name,
  d.selling_price,
  d.created_at,
  d.updated_at,
  ic.items_cost_total
from public.cheffing_dishes d
left join item_costs ic on ic.dish_id = d.id;

insert into public.cheffing_units (code, name, dimension, to_base_factor)
values
  ('g', 'Gramo', 'mass', 1),
  ('kg', 'Kilogramo', 'mass', 1000),
  ('ml', 'Mililitro', 'volume', 1),
  ('l', 'Litro', 'volume', 1000),
  ('u', 'Unidad', 'unit', 1)
on conflict (code) do nothing;
