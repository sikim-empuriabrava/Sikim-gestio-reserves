import { type MenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';

export type MenuSectionKind = 'starter' | 'main' | 'drink' | 'dessert';

export type MenuSectionDiagnostics = {
  calculation_status: 'empty' | 'ok' | 'blocked';
  cost: number | null;
  blocking_reasons: string[];
};

export type MenuCostDiagnostics = {
  calculation_status: 'empty' | 'ok' | 'blocked';
  total: number | null;
  blocking_reasons: string[];
  sections: Record<MenuSectionKind, MenuSectionDiagnostics>;
};

type MenuLineInput = {
  section_kind: MenuSectionKind;
  lineName: string;
  cost: number | null;
};

const MENU_SECTION_KINDS: MenuSectionKind[] = ['starter', 'main', 'drink', 'dessert'];

const roundMoney = (value: number) => Number(value.toFixed(4));

export const getNetPriceFromGross = (grossPrice: number | null, vatRate: MenuEngineeringVatRate): number | null => {
  if (grossPrice === null) return null;
  if (!Number.isFinite(grossPrice)) return null;
  return roundMoney(vatRate === 0 ? grossPrice : grossPrice / (1 + vatRate));
};

export const getMenuObjectivePvpGross = (cost: number | null, vatRate: MenuEngineeringVatRate): number | null => {
  if (cost === null) return null;
  if (!Number.isFinite(cost)) return null;
  return roundMoney(cost * 4 * (1 + vatRate));
};

const getSectionLabel = (sectionKind: MenuSectionKind) => {
  if (sectionKind === 'main') return 'Segundos';
  if (sectionKind === 'starter') return 'Entrantes';
  if (sectionKind === 'drink') return 'Bebidas';
  return 'Postres';
};

const buildMenuSectionDiagnostics = (sectionKind: MenuSectionKind, lines: MenuLineInput[]): MenuSectionDiagnostics => {
  if (lines.length === 0) {
    return {
      calculation_status: 'empty',
      cost: 0,
      blocking_reasons: [],
    };
  }

  const firstMissing = lines.find((line) => line.cost === null);
  if (firstMissing) {
    return {
      calculation_status: 'blocked',
      cost: null,
      blocking_reasons: [
        `No se puede calcular ${getSectionLabel(sectionKind).toLowerCase()} porque la línea "${firstMissing.lineName || 'Sin nombre'}" no tiene coste base calculable.`,
      ],
    };
  }

  const lineCosts = lines.map((line) => line.cost ?? 0);
  const sum = lineCosts.reduce((acc, value) => acc + value, 0);
  const sectionCost = sectionKind === 'main' ? sum / lineCosts.length : sum;

  return {
    calculation_status: 'ok',
    cost: roundMoney(sectionCost),
    blocking_reasons: [],
  };
};

export const getMenuConservativeCostDiagnostics = (lines: MenuLineInput[]): MenuCostDiagnostics => {
  const bySection = MENU_SECTION_KINDS.reduce(
    (acc, sectionKind) => {
      acc[sectionKind] = lines.filter((line) => line.section_kind === sectionKind);
      return acc;
    },
    {} as Record<MenuSectionKind, MenuLineInput[]>,
  );

  const sections = MENU_SECTION_KINDS.reduce(
    (acc, sectionKind) => {
      acc[sectionKind] = buildMenuSectionDiagnostics(sectionKind, bySection[sectionKind]);
      return acc;
    },
    {} as Record<MenuSectionKind, MenuSectionDiagnostics>,
  );

  const blockingReasons = MENU_SECTION_KINDS.flatMap((sectionKind) => sections[sectionKind].blocking_reasons);
  if (blockingReasons.length > 0) {
    return {
      calculation_status: 'blocked',
      total: null,
      blocking_reasons: blockingReasons,
      sections,
    };
  }

  const total = MENU_SECTION_KINDS.reduce((acc, sectionKind) => acc + (sections[sectionKind].cost ?? 0), 0);
  const hasAnyLines = lines.length > 0;

  return {
    calculation_status: hasAnyLines ? 'ok' : 'empty',
    total: roundMoney(total),
    blocking_reasons: [],
    sections,
  };
};
