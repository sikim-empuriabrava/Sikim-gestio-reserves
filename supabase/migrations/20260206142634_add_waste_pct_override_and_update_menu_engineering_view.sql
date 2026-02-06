alter table public.cheffing_dish_items
  add column if not exists waste_pct_override numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_dish_items_waste_pct_override_check'
  ) then
    alter table public.cheffing_dish_items
      add constraint cheffing_dish_items_waste_pct_override_check
      check (
        waste_pct_override is null
        or (waste_pct_override >= 0 and waste_pct_override < 1)
      );
  end if;
end $$;

create or replace view public.v_cheffing_dish_items_cost as
select
  di.*,
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
  end as line_cost_total
from public.cheffing_dish_items di
left join public.cheffing_units u_item on u_item.code = di.unit_code
left join public.v_cheffing_ingredients_cost vic on vic.id = di.ingredient_id
left join public.v_cheffing_subrecipe_cost vsc on vsc.id = di.subrecipe_id;

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
)
select
  d.id,
  d.name,
  d.selling_price,
  (ic.items_cost_total / nullif(coalesce(d.servings, 1), 0))::numeric as cost_per_serving,
  d.created_at,
  d.updated_at
from public.cheffing_dishes d
left join item_costs ic on ic.dish_id = d.id;
