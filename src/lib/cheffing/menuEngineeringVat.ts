export const MENU_ENGINEERING_VAT_RATES = [0, 0.04, 0.1, 0.21] as const;
export type MenuEngineeringVatRate = (typeof MENU_ENGINEERING_VAT_RATES)[number];

export const MENU_ENGINEERING_VAT_MODES = ['included', 'on_top'] as const;
export type MenuEngineeringVatMode = (typeof MENU_ENGINEERING_VAT_MODES)[number];

export function normalizeMenuEngineeringVatRate(
  raw: unknown,
  fallback: MenuEngineeringVatRate = 0.1,
): MenuEngineeringVatRate {
  const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : Number.NaN;
  if (Number.isFinite(parsed) && MENU_ENGINEERING_VAT_RATES.includes(parsed as MenuEngineeringVatRate)) {
    return parsed as MenuEngineeringVatRate;
  }
  return fallback;
}

export function normalizeMenuEngineeringVatMode(
  raw: unknown,
  fallback: MenuEngineeringVatMode = 'included',
): MenuEngineeringVatMode {
  return raw === 'included' || raw === 'on_top' ? raw : fallback;
}
