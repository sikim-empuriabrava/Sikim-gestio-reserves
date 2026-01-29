export type CatalogItem = {
  code: string;
  label: string;
};

export const allergenCatalog: CatalogItem[] = [
  { code: 'lupin', label: 'Altramuz' },
  { code: 'celery', label: 'Apio' },
  { code: 'molluscs', label: 'Moluscos' },
  { code: 'sesame', label: 'Sésamo' },
  { code: 'gluten', label: 'Gluten' },
  { code: 'fish', label: 'Pescado' },
  { code: 'sulphites', label: 'Sulfitos' },
  { code: 'mustard', label: 'Mostaza' },
  { code: 'crustaceans', label: 'Crustáceos' },
  { code: 'lactose', label: 'Lactosa' },
  { code: 'egg', label: 'Huevo' },
  { code: 'soy', label: 'Soja' },
  { code: 'nuts', label: 'Frutos secos' },
  { code: 'peanuts', label: 'Cacahuetes' },
];

export const indicatorCatalog: CatalogItem[] = [
  { code: 'vegano', label: 'Vegano' },
  { code: 'vegetariano', label: 'Vegetariano' },
  { code: 'ecologico', label: 'Ecológico' },
  { code: 'mediterraneo', label: 'Mediterráneo' },
  { code: 'kosher', label: 'Kosher' },
  { code: 'cafeina', label: 'Cafeína' },
  { code: 'sin_azucar', label: 'Sin azúcar' },
  { code: 'estevia', label: 'Estevia' },
  { code: 'halal', label: 'Halal' },
  { code: 'picante_suave', label: 'Picante suave' },
  { code: 'picante', label: 'Picante' },
  { code: 'muy_picante', label: 'Muy picante' },
  { code: 'km0', label: 'KM0' },
  { code: 'comida_rapida', label: 'Comida rápida' },
  { code: 'recomendado', label: 'Recomendado' },
  { code: 'cerdo', label: 'Cerdo' },
  { code: 'maiz', label: 'Maíz' },
  { code: 'setas', label: 'Setas' },
  { code: 'alcohol', label: 'Alcohol' },
  { code: 'infantil', label: 'Infantil' },
];
