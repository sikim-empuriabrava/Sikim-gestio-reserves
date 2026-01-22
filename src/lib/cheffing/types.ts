export type UnitDimension = 'mass' | 'volume' | 'unit';

export type Unit = {
  code: string;
  name: string | null;
  dimension: UnitDimension;
  to_base_factor: number;
};

export type Ingredient = {
  id: string;
  name: string;
  purchase_unit_code: string;
  purchase_pack_qty: number;
  purchase_price: number;
  waste_pct: number;
  created_at: string;
  updated_at: string;
};

export type IngredientCost = Ingredient & {
  purchase_unit_dimension: UnitDimension | null;
  purchase_unit_factor: number | null;
  cost_gross_per_base: number | null;
  cost_net_per_base: number | null;
  waste_factor: number | null;
};

export type Subrecipe = {
  id: string;
  name: string;
  output_unit_code: string;
  output_qty: number;
  waste_pct: number;
  created_at: string;
  updated_at: string;
};

export type SubrecipeItem = {
  id: string;
  subrecipe_id: string;
  ingredient_id: string | null;
  subrecipe_component_id: string | null;
  unit_code: string;
  quantity: number;
  notes: string | null;
};

export type Dish = {
  id: string;
  name: string;
  selling_price: number | null;
  created_at: string;
  updated_at: string;
};

export type DishItem = {
  id: string;
  dish_id: string;
  ingredient_id: string | null;
  subrecipe_id: string | null;
  unit_code: string;
  quantity: number;
  notes: string | null;
};
