import {
  ALLERGEN_KEYS,
  INDICATOR_KEYS,
  type AllergenKey,
  type IndicatorKey,
} from '@/lib/cheffing/allergensIndicators';

export const isAllergenKey = (value: string): value is AllergenKey =>
  (ALLERGEN_KEYS as ReadonlySet<string>).has(value);

export const isIndicatorKey = (value: string): value is IndicatorKey =>
  (INDICATOR_KEYS as ReadonlySet<string>).has(value);

export const toAllergenKeys = (values: string[]): AllergenKey[] => values.filter(isAllergenKey);

export const toIndicatorKeys = (values: string[]): IndicatorKey[] => values.filter(isIndicatorKey);
