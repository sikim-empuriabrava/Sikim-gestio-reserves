import type { Dish, Ingredient, Subrecipe } from '@/lib/cheffing/types';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

const toNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const toStringOrNull = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

export const normalizeIngredient = (raw: Record<string, unknown>): Ingredient => ({
  id: String(raw.id ?? ''),
  name: String(raw.name ?? ''),
  purchase_unit_code: String(raw.purchase_unit_code ?? ''),
  purchase_pack_qty: toNumber(raw.purchase_pack_qty, 0),
  purchase_price: toNumber(raw.purchase_price, 0),
  waste_pct: toNumber(raw.waste_pct, 0),
  categories: toStringArray(raw.categories),
  reference: toStringOrNull(raw.reference),
  stock_unit_code: toStringOrNull(raw.stock_unit_code),
  stock_qty: toNumber(raw.stock_qty, 0),
  min_stock_qty: typeof raw.min_stock_qty === 'number' ? raw.min_stock_qty : null,
  max_stock_qty: typeof raw.max_stock_qty === 'number' ? raw.max_stock_qty : null,
  allergens: toStringArray(raw.allergen_codes ?? raw.allergens),
  indicators: toStringArray(raw.indicator_codes ?? raw.indicators),
  image_path: toStringOrNull(raw.image_path),
  created_at: String(raw.created_at ?? ''),
  updated_at: String(raw.updated_at ?? ''),
});

export const normalizeSubrecipe = (raw: Record<string, unknown>): Subrecipe => ({
  id: String(raw.id ?? ''),
  name: String(raw.name ?? ''),
  output_unit_code: String(raw.output_unit_code ?? ''),
  output_qty: toNumber(raw.output_qty, 0),
  waste_pct: toNumber(raw.waste_pct, 0),
  notes: toStringOrNull(raw.notes),
  allergens_manual_add: toStringArray(raw.allergens_manual_add ?? raw.allergen_codes),
  allergens_manual_exclude: toStringArray(raw.allergens_manual_exclude),
  indicators_manual_add: toStringArray(raw.indicators_manual_add ?? raw.indicator_codes),
  indicators_manual_exclude: toStringArray(raw.indicators_manual_exclude),
  image_path: toStringOrNull(raw.image_path),
  created_at: String(raw.created_at ?? ''),
  updated_at: String(raw.updated_at ?? ''),
});

export const normalizeDishCompatibilityMeta = (
  raw: Record<string, unknown> | null | undefined,
): Pick<
  Dish,
  | 'allergens_manual_add'
  | 'allergens_manual_exclude'
  | 'indicators_manual_add'
  | 'indicators_manual_exclude'
  | 'image_path'
  | 'venue_id'
> => ({
  allergens_manual_add: toStringArray(raw?.allergens_manual_add),
  allergens_manual_exclude: toStringArray(raw?.allergens_manual_exclude),
  indicators_manual_add: toStringArray(raw?.indicators_manual_add),
  indicators_manual_exclude: toStringArray(raw?.indicators_manual_exclude),
  image_path: toStringOrNull(raw?.image_path),
  venue_id: toStringOrNull(raw?.venue_id),
});
