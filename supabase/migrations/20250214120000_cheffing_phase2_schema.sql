-- Cheffing Phase 2 updates

-- New columns
alter table public.cheffing_subrecipe_items
  add column if not exists waste_pct numeric not null default 0;

alter table public.cheffing_dish_items
  add column if not exists waste_pct numeric not null default 0;

alter table public.cheffing_dishes
  add column if not exists servings numeric not null default 1,
  add column if not exists notes text;

-- Constraints
DO $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cheffing_subrecipe_items_waste_pct_check'
  ) then
    alter table public.cheffing_subrecipe_items
      add constraint cheffing_subrecipe_items_waste_pct_check
      check (waste_pct >= 0 and waste_pct < 1);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'cheffing_dish_items_waste_pct_check'
  ) then
    alter table public.cheffing_dish_items
      add constraint cheffing_dish_items_waste_pct_check
      check (waste_pct >= 0 and waste_pct < 1);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'cheffing_dishes_servings_check'
  ) then
    alter table public.cheffing_dishes
      add constraint cheffing_dishes_servings_check
      check (servings > 0);
  end if;
end $$;

-- Unique item constraints to avoid duplicates inside the same parent
create unique index if not exists cheffing_subrecipe_items_unique_ingredient
  on public.cheffing_subrecipe_items (subrecipe_id, ingredient_id)
  where ingredient_id is not null;

create unique index if not exists cheffing_subrecipe_items_unique_component
  on public.cheffing_subrecipe_items (subrecipe_id, subrecipe_component_id)
  where subrecipe_component_id is not null;

create unique index if not exists cheffing_dish_items_unique_ingredient
  on public.cheffing_dish_items (dish_id, ingredient_id)
  where ingredient_id is not null;

create unique index if not exists cheffing_dish_items_unique_subrecipe
  on public.cheffing_dish_items (dish_id, subrecipe_id)
  where subrecipe_id is not null;

-- Updated cost views (including waste_pct on items and servings)
create or replace view public.v_cheffing_subrecipe_cost as
with recursive expanded_items as (
  select
    s.id as root_subrecipe_id,
    si.ingredient_id,
    si.subrecipe_component_id,
    si.quantity,
    si.unit_code,
    si.waste_pct,
    1::numeric as scale_factor,
    array[s.id]::uuid[] as path,
    1 as depth
  from public.cheffing_subrecipes s
  join public.cheffing_subrecipe_items si on si.subrecipe_id = s.id

  union all

  select
    ei.root_subrecipe_id,
    si_child.ingredient_id,
    si_child.subrecipe_component_id,
    si_child.quantity,
    si_child.unit_code,
    si_child.waste_pct,
    ei.scale_factor
      * (ei.quantity * u_parent.to_base_factor)
      / nullif(sr_output.output_qty * u_output.to_base_factor, 0)
      / nullif(1 - ei.waste_pct, 0) as scale_factor,
    ei.path || sr_output.id,
    ei.depth + 1
  from expanded_items ei
  join public.cheffing_subrecipes sr_output on sr_output.id = ei.subrecipe_component_id
  join public.cheffing_units u_parent on u_parent.code = ei.unit_code
  join public.cheffing_units u_output on u_output.code = sr_output.output_unit_code
  join public.cheffing_subrecipe_items si_child on si_child.subrecipe_id = sr_output.id
  where ei.subrecipe_component_id is not null
    and not (sr_output.id = any(ei.path))
    and ei.depth < 25
),
item_costs as (
  select
    s.id as subrecipe_id,
    case
      when count(ei.ingredient_id) + count(ei.subrecipe_component_id) = 0 then 0
      else sum(
        case
          when ei.ingredient_id is not null
            and u_item.dimension = vic.purchase_unit_dimension
            then (vic.cost_net_per_base * (ei.quantity * u_item.to_base_factor) * ei.scale_factor)
                 / nullif(1 - ei.waste_pct, 0)
          else null
        end
      )
    end as items_cost_total
  from public.cheffing_subrecipes s
  left join expanded_items ei on ei.root_subrecipe_id = s.id
  left join public.cheffing_units u_item on u_item.code = ei.unit_code
  left join public.v_cheffing_ingredients_cost vic on vic.id = ei.ingredient_id
  group by s.id
)
select
  s.id,
  s.name,
  s.output_unit_code,
  s.output_qty,
  s.waste_pct,
  s.notes,
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

create or replace view public.v_cheffing_subrecipe_items_cost as
select
  si.*,
  case
    when si.ingredient_id is not null
      and u_item.dimension = vic.purchase_unit_dimension
      then (vic.cost_net_per_base * (si.quantity * u_item.to_base_factor)) / nullif(1 - si.waste_pct, 0)
    when si.subrecipe_component_id is not null
      and u_item.dimension = vsc.output_unit_dimension
      then (vsc.cost_net_per_base * (si.quantity * u_item.to_base_factor)) / nullif(1 - si.waste_pct, 0)
    else null
  end as line_cost_total
from public.cheffing_subrecipe_items si
left join public.cheffing_units u_item on u_item.code = si.unit_code
left join public.v_cheffing_ingredients_cost vic on vic.id = si.ingredient_id
left join public.v_cheffing_subrecipe_cost vsc on vsc.id = si.subrecipe_component_id;

create or replace view public.v_cheffing_dish_cost as
with item_costs as (
  select
    d.id as dish_id,
    case
      when count(di.id) = 0 then 0
      else sum(
        case
          when di.ingredient_id is not null
            and u_item.dimension = vic.purchase_unit_dimension
            then (vic.cost_net_per_base * (di.quantity * u_item.to_base_factor)) / nullif(1 - di.waste_pct, 0)
          when di.subrecipe_id is not null
            and u_item.dimension = vsc.output_unit_dimension
            then (vsc.cost_net_per_base * (di.quantity * u_item.to_base_factor)) / nullif(1 - di.waste_pct, 0)
          else null
        end
      )
    end as items_cost_total
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
  d.servings,
  d.notes,
  d.created_at,
  d.updated_at,
  ic.items_cost_total,
  (ic.items_cost_total / nullif(d.servings, 0)) as cost_per_serving
from public.cheffing_dishes d
left join item_costs ic on ic.dish_id = d.id;

create or replace view public.v_cheffing_dish_items_cost as
select
  di.*,
  case
    when di.ingredient_id is not null
      and u_item.dimension = vic.purchase_unit_dimension
      then (vic.cost_net_per_base * (di.quantity * u_item.to_base_factor)) / nullif(1 - di.waste_pct, 0)
    when di.subrecipe_id is not null
      and u_item.dimension = vsc.output_unit_dimension
      then (vsc.cost_net_per_base * (di.quantity * u_item.to_base_factor)) / nullif(1 - di.waste_pct, 0)
    else null
  end as line_cost_total
from public.cheffing_dish_items di
left join public.cheffing_units u_item on u_item.code = di.unit_code
left join public.v_cheffing_ingredients_cost vic on vic.id = di.ingredient_id
left join public.v_cheffing_subrecipe_cost vsc on vsc.id = di.subrecipe_id;

-- Regression queries (manual checks)
-- 1) Ingrediente con merma: coste neto base
-- select id, name, cost_net_per_base from public.v_cheffing_ingredients_cost where name ilike '%tomate%';
-- 2) Línea de subreceta con merma
-- select id, line_cost_total from public.v_cheffing_subrecipe_items_cost where subrecipe_id = '<uuid_subrecipe>';
-- 3) Subreceta con subreceta hija (sin ciclo) y scale_factor consistente
-- select id, items_cost_total, cost_net_per_base from public.v_cheffing_subrecipe_cost where id = '<uuid_subrecipe>';
-- 4) Caso con ciclo (A incluye B y B incluye A) no debe colgarse
-- select id, items_cost_total from public.v_cheffing_subrecipe_cost where id in ('<uuid_a>', '<uuid_b>');
-- 5) Plato con servings > 1: coste por ración
-- select id, items_cost_total, cost_per_serving from public.v_cheffing_dish_cost where id = '<uuid_dish>';
