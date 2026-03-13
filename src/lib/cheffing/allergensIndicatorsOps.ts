import type { AllergenKey, ProductIndicatorKey } from './allergensIndicators';
import { sanitizeAllergens, sanitizeProductIndicators } from './allergensHelpers';

export type EffectiveAI = {
  allergens: AllergenKey[];
  indicators: ProductIndicatorKey[];
};

export function addAllergens(set: Set<AllergenKey>, input: unknown) {
  sanitizeAllergens(input).forEach((key) => set.add(key));
}

export function addIndicators(set: Set<ProductIndicatorKey>, input: unknown) {
  sanitizeProductIndicators(input).forEach((key) => set.add(key));
}

export function removeAllergens(set: Set<AllergenKey>, input: unknown) {
  sanitizeAllergens(input).forEach((key) => set.delete(key));
}

export function removeIndicators(set: Set<ProductIndicatorKey>, input: unknown) {
  sanitizeProductIndicators(input).forEach((key) => set.delete(key));
}
