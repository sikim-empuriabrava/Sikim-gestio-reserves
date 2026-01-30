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

const sanitizeKeyArray = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === 'string');
};

export const sanitizeAllergens = (values: unknown): AllergenKey[] =>
  sanitizeKeyArray(values).filter(isAllergenKey);

export const sanitizeIndicators = (values: unknown): IndicatorKey[] =>
  sanitizeKeyArray(values).filter(isIndicatorKey);
