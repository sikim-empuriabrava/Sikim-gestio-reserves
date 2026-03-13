import {
  ALLERGEN_CATALOG,
  ALLERGEN_CODE_SET,
  type AllergenCode,
} from './allergens';
import {
  DISH_INDICATOR_CATALOG,
  DISH_INDICATOR_CODE_SET,
  INDICATOR_CATALOG,
  INDICATOR_CODE_SET,
  PRODUCT_INDICATOR_CATALOG,
  PRODUCT_INDICATOR_CODE_SET,
  type DishIndicatorCode,
  type IndicatorCode,
  type ProductIndicatorCode,
} from './indicators';

export const ALLERGENS = ALLERGEN_CATALOG.map(({ code, label }) => ({
  key: code,
  label,
})) as ReadonlyArray<{ key: AllergenCode; label: string }>;

export type AllergenKey = AllergenCode;

export const INDICATORS = INDICATOR_CATALOG.map(({ code, label }) => ({
  key: code,
  label,
})) as ReadonlyArray<{ key: IndicatorCode; label: string }>;

export const PRODUCT_INDICATORS = PRODUCT_INDICATOR_CATALOG.map(({ code, label }) => ({
  key: code,
  label,
})) as ReadonlyArray<{ key: ProductIndicatorCode; label: string }>;

export const DISH_INDICATORS = DISH_INDICATOR_CATALOG.map(({ code, label }) => ({
  key: code,
  label,
})) as ReadonlyArray<{ key: DishIndicatorCode; label: string }>;

export type IndicatorKey = IndicatorCode;
export type ProductIndicatorKey = ProductIndicatorCode;
export type DishIndicatorKey = DishIndicatorCode;

export const ALLERGEN_KEYS = ALLERGEN_CODE_SET;
export const INDICATOR_KEYS = INDICATOR_CODE_SET;
export const PRODUCT_INDICATOR_KEYS = PRODUCT_INDICATOR_CODE_SET;
export const DISH_INDICATOR_KEYS = DISH_INDICATOR_CODE_SET;

export function sanitizeAllergenIndicatorArray(
  value: unknown,
  allowedKeys: Set<string>,
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const cleaned = value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry) => entry && allowedKeys.has(entry));
  return Array.from(new Set(cleaned));
}
