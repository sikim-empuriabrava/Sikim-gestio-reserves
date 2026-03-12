import {
  ALLERGEN_CATALOG,
  ALLERGEN_CODE_SET,
  type AllergenCode,
} from './allergens';
import {
  INDICATOR_CATALOG,
  INDICATOR_CODE_SET,
  type IndicatorCode,
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

export type IndicatorKey = IndicatorCode;

export const ALLERGEN_KEYS = ALLERGEN_CODE_SET;
export const INDICATOR_KEYS = INDICATOR_CODE_SET;

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
