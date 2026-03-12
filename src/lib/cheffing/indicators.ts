export const INDICATOR_CATALOG = [
  { code: 'vegan', label: 'Vegano' },
  { code: 'vegetarian', label: 'Vegetariano' },
  { code: 'spicy', label: 'Picante' },
  { code: 'very_spicy', label: 'Muy picante' },
  { code: 'contains_alcohol', label: 'Contiene alcohol' },
  { code: 'halal', label: 'Halal' },
  { code: 'kosher', label: 'Kosher' },
] as const;

export type IndicatorCode = (typeof INDICATOR_CATALOG)[number]['code'];

export const INDICATOR_CODE_SET = new Set<string>(INDICATOR_CATALOG.map((item) => item.code));
