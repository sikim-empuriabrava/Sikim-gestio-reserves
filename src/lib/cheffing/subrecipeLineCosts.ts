import type { UnitDimension } from '@/lib/cheffing/types';

type SubrecipeItemCostInput = {
  ingredient_id: string | null;
  subrecipe_component_id: string | null;
  unit_code: string;
  quantity: number | string | null;
};

type UnitCostInput = {
  code: string;
  dimension: UnitDimension | string | null;
  to_base_factor: number | string | null;
};

type IngredientCostInput = {
  id: string;
  purchase_unit_dimension: UnitDimension | string | null;
  cost_net_per_base: number | string | null;
};

type SubrecipeCostInput = {
  id: string;
  output_unit_dimension: UnitDimension | string | null;
  cost_net_per_base: number | string | null;
};

const toFiniteNumber = (value: number | string | null | undefined) => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

export function withSubrecipeLineCosts<T extends SubrecipeItemCostInput>({
  items,
  units,
  ingredientCosts,
  subrecipeCosts,
}: {
  items: T[];
  units: UnitCostInput[];
  ingredientCosts: IngredientCostInput[];
  subrecipeCosts: SubrecipeCostInput[];
}) {
  const unitsByCode = new Map(units.map((unit) => [unit.code, unit] as const));
  const ingredientCostsById = new Map(ingredientCosts.map((cost) => [cost.id, cost] as const));
  const subrecipeCostsById = new Map(subrecipeCosts.map((cost) => [cost.id, cost] as const));

  return items.map((item) => {
    const unit = unitsByCode.get(item.unit_code);
    const quantity = toFiniteNumber(item.quantity);
    const unitFactor = toFiniteNumber(unit?.to_base_factor);

    if (!unit || quantity === null || unitFactor === null) {
      return { ...item, line_cost_total: null };
    }

    if (item.ingredient_id) {
      const ingredientCost = ingredientCostsById.get(item.ingredient_id);
      const costNetPerBase = toFiniteNumber(ingredientCost?.cost_net_per_base);

      if (
        ingredientCost &&
        unit.dimension === ingredientCost.purchase_unit_dimension &&
        costNetPerBase !== null
      ) {
        return { ...item, line_cost_total: costNetPerBase * quantity * unitFactor };
      }
    }

    if (item.subrecipe_component_id) {
      const subrecipeCost = subrecipeCostsById.get(item.subrecipe_component_id);
      const costNetPerBase = toFiniteNumber(subrecipeCost?.cost_net_per_base);

      if (
        subrecipeCost &&
        unit.dimension === subrecipeCost.output_unit_dimension &&
        costNetPerBase !== null
      ) {
        return { ...item, line_cost_total: costNetPerBase * quantity * unitFactor };
      }
    }

    return { ...item, line_cost_total: null };
  });
}
