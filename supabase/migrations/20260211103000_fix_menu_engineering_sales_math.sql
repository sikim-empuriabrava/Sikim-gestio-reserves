alter table public.cheffing_dishes
  add column if not exists servings numeric,
  add column if not exists units_sold integer;

update public.cheffing_dishes
set servings = 1
where servings is null;

update public.cheffing_dishes
set units_sold = 0
where units_sold is null;

alter table public.cheffing_dishes
  alter column servings type numeric using servings::numeric,
  alter column servings set default 1,
  alter column servings set not null,
  alter column units_sold type integer using greatest(0, coalesce(units_sold, 0))::integer,
  alter column units_sold set default 0,
  alter column units_sold set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_dishes_servings_check'
      and conrelid = 'public.cheffing_dishes'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_dishes_servings_positive'
      and conrelid = 'public.cheffing_dishes'::regclass
  ) then
    alter table public.cheffing_dishes
      rename constraint cheffing_dishes_servings_check to cheffing_dishes_servings_positive;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_dishes_servings_positive'
      and conrelid = 'public.cheffing_dishes'::regclass
  ) then
    alter table public.cheffing_dishes
      add constraint cheffing_dishes_servings_positive
      check (servings > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_dishes_units_sold_nonnegative'
      and conrelid = 'public.cheffing_dishes'::regclass
  ) then
    alter table public.cheffing_dishes
      add constraint cheffing_dishes_units_sold_nonnegative
      check (units_sold >= 0);
  end if;
end $$;

comment on column public.cheffing_dishes.servings is
  'Yield de receta (raciones producidas); se usa para coste por ración, no para ventas.';

comment on column public.cheffing_dishes.units_sold is
  'Unidades vendidas agregadas (POS/SumUp o placeholder temporal para menu engineering).';

create or replace view public.v_cheffing_menu_engineering_dish_cost as
with item_costs as (
  select
    d.id as dish_id,
    sum(
      case
        when di.ingredient_id is not null
          and u_item.dimension = vic.purchase_unit_dimension
          then (vic.cost_net_per_base * (di.quantity * u_item.to_base_factor))
            / nullif(1 - coalesce(di.waste_pct_override, vic.waste_pct, 0), 0)
        when di.subrecipe_id is not null
          and u_item.dimension = vsc.output_unit_dimension
          then (vsc.cost_net_per_base * (di.quantity * u_item.to_base_factor))
            / nullif(1 - coalesce(di.waste_pct_override, 0), 0)
        else null
      end
    ) as items_cost_total
  from public.cheffing_dishes d
  left join public.cheffing_dish_items di on di.dish_id = d.id
  left join public.v_cheffing_ingredients_cost vic on vic.id = di.ingredient_id
  left join public.v_cheffing_subrecipe_cost vsc on vsc.id = di.subrecipe_id
  left join public.cheffing_units u_item on u_item.code = di.unit_code
  group by d.id
), sold_units as (
  select
    l.dish_id,
    sum(coalesce(s.units, 0))::integer as units_sold
  from public.cheffing_pos_product_links l
  left join public.cheffing_pos_sales_daily s on s.pos_product_id = l.pos_product_id
  group by l.dish_id
)
select
  d.id,
  d.name,
  d.selling_price,
  (ic.items_cost_total / nullif(coalesce(d.servings, 1), 0))::numeric as cost_per_serving,
  coalesce(su.units_sold, d.units_sold, 0)::integer as units_sold,
  d.created_at,
  d.updated_at
from public.cheffing_dishes d
left join item_costs ic on ic.dish_id = d.id
left join sold_units su on su.dish_id = d.id;
