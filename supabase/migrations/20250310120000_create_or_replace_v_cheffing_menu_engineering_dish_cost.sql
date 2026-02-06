create or replace view public.v_cheffing_menu_engineering_dish_cost as
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
  (ic.items_cost_total / nullif(d.servings, 0))::numeric as cost_per_serving,
  d.created_at,
  d.updated_at
from public.cheffing_dishes d
left join item_costs ic on ic.dish_id = d.id;
