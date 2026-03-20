export const SIN_FAMILIA_LABEL = 'Sin familia';

export type CheffingFamilyKind = 'food' | 'drink';

export type CheffingFamily = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  kind?: CheffingFamilyKind | null;
};

export const slugifyFamilyName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
