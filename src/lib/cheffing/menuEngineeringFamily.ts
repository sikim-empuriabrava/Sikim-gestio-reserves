export const MENU_ENGINEERING_FAMILIES = [
  'Amanidas',
  'Arrebosats',
  'Carn',
  'Carpaccio',
  'Coktails',
  'Combinats',
  'Entras freds',
  'Foodtruck',
  'Hambuergueses',
  'Pasta / Arros',
  'Patates',
  'Peix',
  'Postres',
  'Refrescos',
  'Resfrescos Pub',
  'Saltejats',
  'Sin familia',
  'Snacks',
] as const;

export type MenuEngineeringDishFamily = (typeof MENU_ENGINEERING_FAMILIES)[number];

/**
 * Legacy helper used by Menu Engineering historical derivation/import paths.
 * Canonical family model for dishes is now `cheffing_dishes.family_id`.
 */

const normalizeTag = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const tagSetHasAny = (tags: Set<string>, candidates: string[]) => candidates.some((candidate) => tags.has(candidate));

export const resolveDishFamilyFromSourceTags = (sourceTagNames: string[] | null | undefined): MenuEngineeringDishFamily => {
  if (!sourceTagNames || sourceTagNames.length === 0) {
    return 'Sin familia';
  }

  const normalizedTags = sourceTagNames.map(normalizeTag).filter(Boolean);
  const tagSet = new Set(normalizedTags);

  if (tagSet.has('cocktail')) {
    return 'Coktails';
  }

  if (
    tagSetHasAny(tagSet, ['vodka', 'ron', 'whisky', 'ginebra', 'alcohol']) &&
    !tagSet.has('cocktail')
  ) {
    return 'Combinats';
  }

  if (tagSetHasAny(tagSet, ['aigua', 'aigues', 'refresc', 'granadina'])) {
    return 'Refrescos';
  }

  if (tagSet.has('redbull')) {
    return 'Resfrescos Pub';
  }

  if (tagSetHasAny(tagSet, ['coca de pa de vidre', 'entrants', 'compartir'])) {
    return 'Entras freds';
  }

  if (tagSet.has('postres')) {
    return 'Postres';
  }

  if (tagSet.has('saltejats')) {
    return 'Saltejats';
  }

  if (tagSet.has('snacks')) {
    return 'Snacks';
  }

  if (tagSet.has('peix')) {
    return 'Peix';
  }

  if (tagSet.has('hamburgueses')) {
    return 'Hambuergueses';
  }

  if (tagSet.has('carpaccios')) {
    return 'Carpaccio';
  }

  if (tagSet.has('pasta / arros')) {
    return 'Pasta / Arros';
  }

  if (tagSet.has('amanides / verdures')) {
    return 'Amanidas';
  }

  if (tagSet.has('arrebossats i tempures')) {
    return 'Arrebosats';
  }

  if (tagSetHasAny(tagSet, ['plats de carn', 'carns'])) {
    return 'Carn';
  }

  if (tagSet.has('entrepans')) {
    return 'Foodtruck';
  }

  if (tagSet.has('patates / ous')) {
    return 'Patates';
  }

  return 'Sin familia';
};
