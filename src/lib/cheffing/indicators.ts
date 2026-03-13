export const PRODUCT_INDICATOR_CATALOG = [
  { code: 'spicy', label: 'Picante' },
  { code: 'very_spicy', label: 'Muy picante' },
  { code: 'contains_alcohol', label: 'Contiene alcohol' },
  { code: 'contains_pork', label: 'Contiene cerdo' },
] as const;

export const DISH_INDICATOR_CATALOG = [
  { code: 'vegan', label: 'Vegano' },
  { code: 'vegetarian', label: 'Vegetariano' },
  { code: 'halal', label: 'Halal' },
  { code: 'kosher', label: 'Kosher' },
] as const;

export const INDICATOR_CATALOG = [...PRODUCT_INDICATOR_CATALOG, ...DISH_INDICATOR_CATALOG] as const;

export type ProductIndicatorCode = (typeof PRODUCT_INDICATOR_CATALOG)[number]['code'];
export type DishIndicatorCode = (typeof DISH_INDICATOR_CATALOG)[number]['code'];
export type IndicatorCode = ProductIndicatorCode | DishIndicatorCode;

export const INDICATOR_CODE_SET = new Set<string>(INDICATOR_CATALOG.map((item) => item.code));
export const PRODUCT_INDICATOR_CODE_SET = new Set<string>(
  PRODUCT_INDICATOR_CATALOG.map((item) => item.code),
);
export const DISH_INDICATOR_CODE_SET = new Set<string>(DISH_INDICATOR_CATALOG.map((item) => item.code));
