import type { AllergenKey, IndicatorKey } from './allergensIndicators';
import { sanitizeAllergens, sanitizeIndicators } from './allergensHelpers';

export type EffectiveAI = {
  allergens: AllergenKey[];
  indicators: IndicatorKey[];
};

export function addAllergens(set: Set<AllergenKey>, input: unknown) {
  sanitizeAllergens(input).forEach((key) => set.add(key));
}

export function addIndicators(set: Set<IndicatorKey>, input: unknown) {
  sanitizeIndicators(input).forEach((key) => set.add(key));
}

export function removeAllergens(set: Set<AllergenKey>, input: unknown) {
  sanitizeAllergens(input).forEach((key) => set.delete(key));
}

export function removeIndicators(set: Set<IndicatorKey>, input: unknown) {
  sanitizeIndicators(input).forEach((key) => set.delete(key));
}
