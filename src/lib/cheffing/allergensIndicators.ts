export const ALLERGENS = [
  { key: 'gluten', label: 'Gluten' },
  { key: 'crustaceans', label: 'Crustáceos' },
  { key: 'eggs', label: 'Huevo' },
  { key: 'fish', label: 'Pescado' },
  { key: 'peanuts', label: 'Cacahuetes' },
  { key: 'soy', label: 'Soja' },
  { key: 'milk', label: 'Leche' },
  { key: 'nuts', label: 'Frutos secos' },
  { key: 'celery', label: 'Apio' },
  { key: 'mustard', label: 'Mostaza' },
  { key: 'sesame', label: 'Sésamo' },
  { key: 'sulphites', label: 'Sulfitos' },
  { key: 'lupin', label: 'Altramuz' },
  { key: 'molluscs', label: 'Moluscos' },
] as const;

export type AllergenKey = (typeof ALLERGENS)[number]['key'];

export const INDICATORS = [
  { key: 'vegan', label: 'Vegano' },
  { key: 'vegetarian', label: 'Vegetariano' },
  { key: 'spicy', label: 'Picante' },
  { key: 'very_spicy', label: 'Muy picante' },
  { key: 'contains_alcohol', label: 'Contiene alcohol' },
  { key: 'halal', label: 'Halal' },
  { key: 'kosher', label: 'Kosher' },
] as const;

export type IndicatorKey = (typeof INDICATORS)[number]['key'];

export const ALLERGEN_KEYS = new Set(ALLERGENS.map((allergen) => allergen.key));
export const INDICATOR_KEYS = new Set(INDICATORS.map((indicator) => indicator.key));

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
