import {
  ALLERGEN_KEYS,
  DISH_INDICATOR_KEYS,
  INDICATOR_KEYS,
  PRODUCT_INDICATOR_KEYS,
  type AllergenKey,
  type DishIndicatorKey,
  type IndicatorKey,
  type ProductIndicatorKey,
} from '@/lib/cheffing/allergensIndicators';

export const isAllergenKey = (value: string): value is AllergenKey =>
  (ALLERGEN_KEYS as ReadonlySet<string>).has(value);

export const isIndicatorKey = (value: string): value is IndicatorKey =>
  (INDICATOR_KEYS as ReadonlySet<string>).has(value);

export const isProductIndicatorKey = (value: string): value is ProductIndicatorKey =>
  (PRODUCT_INDICATOR_KEYS as ReadonlySet<string>).has(value);

export const isDishIndicatorKey = (value: string): value is DishIndicatorKey =>
  (DISH_INDICATOR_KEYS as ReadonlySet<string>).has(value);

export const toAllergenKeys = (values: string[]): AllergenKey[] => values.filter(isAllergenKey);

export const toIndicatorKeys = (values: string[]): IndicatorKey[] => values.filter(isIndicatorKey);
export const toProductIndicatorKeys = (values: string[]): ProductIndicatorKey[] =>
  values.filter(isProductIndicatorKey);
export const toDishIndicatorKeys = (values: string[]): DishIndicatorKey[] =>
  values.filter(isDishIndicatorKey);

const sanitizeKeyArray = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === 'string');
};

export const sanitizeAllergens = (values: unknown): AllergenKey[] =>
  sanitizeKeyArray(values).filter(isAllergenKey);

export const sanitizeIndicators = (values: unknown): IndicatorKey[] =>
  sanitizeKeyArray(values).filter(isIndicatorKey);

export const sanitizeProductIndicators = (values: unknown): ProductIndicatorKey[] =>
  sanitizeKeyArray(values).filter(isProductIndicatorKey);

export const sanitizeDishIndicators = (values: unknown): DishIndicatorKey[] =>
  sanitizeKeyArray(values).filter(isDishIndicatorKey);
