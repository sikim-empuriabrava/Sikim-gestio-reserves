alter table public.cheffing_dishes
  add column if not exists servings integer,
  add column if not exists units_sold numeric not null default 0;

update public.cheffing_dishes
set servings = 1
where servings is null;

alter table public.cheffing_dishes
  alter column servings set default 1,
  alter column servings set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_dishes_servings_check'
  ) then
    alter table public.cheffing_dishes
      add constraint cheffing_dishes_servings_check
      check (servings > 0);
  end if;
end $$;

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
    sum(coalesce(s.units, 0))::numeric as units_sold
  from public.cheffing_pos_product_links l
  left join public.cheffing_pos_sales_daily s on s.pos_product_id = l.pos_product_id
  group by l.dish_id
)
select
  d.id,
  d.name,
  d.selling_price,
  (ic.items_cost_total / nullif(coalesce(d.servings, 1), 0))::numeric as cost_per_serving,
  coalesce(su.units_sold, d.units_sold, 0)::numeric as units_sold,
  d.created_at,
  d.updated_at
from public.cheffing_dishes d
left join item_costs ic on ic.dish_id = d.id
left join sold_units su on su.dish_id = d.id;
