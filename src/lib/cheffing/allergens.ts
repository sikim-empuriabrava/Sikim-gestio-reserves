export const ALLERGEN_CATALOG = [
  { code: 'gluten', label: 'Gluten' },
  { code: 'crustaceans', label: 'Crustáceos' },
  { code: 'eggs', label: 'Huevo' },
  { code: 'fish', label: 'Pescado' },
  { code: 'milk', label: 'Leche' },
  { code: 'mustard', label: 'Mostaza' },
  { code: 'lupin', label: 'Altramuz' },
  { code: 'molluscs', label: 'Moluscos' },
  { code: 'sesame', label: 'Sésamo' },
  { code: 'nuts', label: 'Frutos secos' },
  { code: 'peanuts', label: 'Cacahuetes' },
  { code: 'soy', label: 'Soja' },
  { code: 'celery', label: 'Apio' },
  { code: 'sulphites', label: 'Sulfitos' },
] as const;

export type AllergenCode = (typeof ALLERGEN_CATALOG)[number]['code'];

export const ALLERGEN_CODE_SET = new Set<string>(ALLERGEN_CATALOG.map((item) => item.code));
