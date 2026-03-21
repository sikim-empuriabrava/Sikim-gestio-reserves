import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { type MenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';
import {
  MENU_ENGINEERING_FAMILIES,
  resolveDishFamilyFromSourceTags,
  type MenuEngineeringDishFamily,
} from '@/lib/cheffing/menuEngineeringFamily';
import { getMenuConservativeCostDiagnostics, getMenuObjectivePvpGross, getNetPriceFromGross } from '@/lib/cheffing/menuEconomics';

export type MenuEngineeringRow = {
  id: string;
  name: string;
  family: MenuEngineeringDishFamily;
  source: 'dish' | 'menu';
  selling_price_gross: number | null;
  vat_rate: number;
  units_sold: number;
  has_sales_data: boolean;
  cost_per_serving: number | null;
  net_price: number | null;
  margin_unit: number | null;
  cogs_pct: number | null;
  margin_pct: number | null;
  pvp_objetivo_gross: number | null;
  dif: number | null;
  total_sales_gross: number;
  total_sales_net: number | null;
  total_margin: number | null;
  bcm_margin_g: number | null;
  bcm_popularity_index: number | null;
  bcm_popularity_g: number | null;
  bcm: 'ESTRELLA' | 'VACA' | 'PUZZLE' | 'PERRO' | 'SIN_DATOS';
  high_popularity: boolean;
  high_margin: boolean;
};

export type MenuEngineeringRowBase = Omit<
  MenuEngineeringRow,
  'bcm_margin_g' | 'bcm_popularity_index' | 'bcm_popularity_g' | 'bcm' | 'high_popularity' | 'high_margin'
>;

export type MenuEngineeringPivots = {
  popularity: number;
  margin: number;
};

export type MenuEngineeringBcmStats = {
  totalUnitsSold: number;
  totalSales: number;
  totalMargin: number;
  dishCount: number;
  marginAverage: number;
  costProductPct: number;
  popularityCorrectionPct: number;
  popularityIndexAverage: number;
};

type NormalizedDateRange = { from: string; to: string };
export type MenuEngineeringView = 'platos' | 'bebidas' | 'menus';

const toNumber = (value: number | null) => (value === null || Number.isNaN(value) ? null : value);

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const isValidISODate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const normalizeDateRange = (range?: { from?: string; to?: string }): NormalizedDateRange | null => {
  const from = range?.from;
  const to = range?.to;

  if (!from || !to) {
    return null;
  }

  if (!isValidISODate(from) || !isValidISODate(to)) {
    return null;
  }

  if (from > to) {
    return null;
  }

  return { from, to };
};

const toFiniteNumber = (value: number) => (Number.isFinite(value) ? value : 0);

function computeBcm(rows: MenuEngineeringRowBase[]): {
  rowsEnriched: MenuEngineeringRow[];
  pivots: MenuEngineeringPivots;
  stats: MenuEngineeringBcmStats;
} {
  const bcmRows = rows.filter(
    (row) => row.margin_unit !== null && Number.isFinite(row.margin_unit) && Number.isFinite(row.units_sold) && row.units_sold > 0,
  );

  const totalUnits = bcmRows.reduce((acc, row) => acc + toFiniteNumber(row.units_sold), 0);
  const totalSales = bcmRows.reduce((acc, row) => acc + (row.total_sales_net !== null ? toFiniteNumber(row.total_sales_net) : 0), 0);
  const totalMargin = bcmRows.reduce((acc, row) => acc + (row.total_margin !== null ? toFiniteNumber(row.total_margin) : 0), 0);
  const dishCount = bcmRows.length;
  const popularityCorrectionPct = 0.7;
  const marginPivot = totalUnits > 0 ? totalMargin / totalUnits : 0;
  const popularityPivot = dishCount > 0 ? (1 / dishCount) * popularityCorrectionPct : 0;
  const costProductPct = totalSales > 0 ? (totalSales - totalMargin) / totalSales : 0;

  const stats: MenuEngineeringBcmStats = {
    totalUnitsSold: toFiniteNumber(totalUnits),
    totalSales: toFiniteNumber(totalSales),
    totalMargin: toFiniteNumber(totalMargin),
    dishCount,
    marginAverage: toFiniteNumber(marginPivot),
    costProductPct: toFiniteNumber(costProductPct),
    popularityCorrectionPct,
    popularityIndexAverage: toFiniteNumber(popularityPivot),
  };

  const pivots: MenuEngineeringPivots = {
    popularity: toFiniteNumber(popularityPivot),
    margin: toFiniteNumber(marginPivot),
  };

  if (dishCount === 0 || totalUnits === 0) {
    const rowsEnriched = rows.map((row) => ({
      ...row,
      bcm_margin_g: null,
      bcm_popularity_index: null,
      bcm_popularity_g: null,
      bcm: 'SIN_DATOS' as const,
      high_popularity: false,
      high_margin: false,
    }));

    return { rowsEnriched, pivots, stats };
  }

  const rowsEnriched = rows.map((row) => {
    const units = row.units_sold;
    const marginUnit = row.margin_unit;

    const hasUnits = Number.isFinite(units);
    const hasMargin = marginUnit !== null && Number.isFinite(marginUnit);

    if (!hasUnits || !hasMargin) {
      return {
        ...row,
        bcm_margin_g: null,
        bcm_popularity_index: null,
        bcm_popularity_g: null,
        bcm: 'SIN_DATOS' as const,
        high_popularity: false,
        high_margin: false,
      };
    }

    const popularityIndex = units / totalUnits;
    const highPopularity = popularityIndex >= pivots.popularity;
    const highMargin = marginUnit >= pivots.margin;
    const marginG = marginUnit - pivots.margin;
    const popularityG = popularityIndex - pivots.popularity;

    let bcm: MenuEngineeringRow['bcm'] = 'PERRO';

    if (highPopularity && highMargin) {
      bcm = 'ESTRELLA';
    } else if (highPopularity && !highMargin) {
      bcm = 'VACA';
    } else if (!highPopularity && highMargin) {
      bcm = 'PUZZLE';
    }

    return {
      ...row,
      bcm_margin_g: marginG,
      bcm_popularity_index: popularityIndex,
      bcm_popularity_g: popularityG,
      bcm,
      high_popularity: highPopularity,
      high_margin: highMargin,
    };
  });

  return { rowsEnriched, pivots, stats };
}

export async function getMenuEngineeringRows(
  vatRate: MenuEngineeringVatRate,
  range?: { from?: string; to?: string },
  family?: MenuEngineeringDishFamily,
  view: MenuEngineeringView = 'platos',
) {
  if (view === 'menus') {
    return getMenuEngineeringMenuRows(vatRate);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_menu_engineering_dish_cost')
    .select('id, name, selling_price, cost_per_serving, units_sold')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const dishIds = (data ?? []).map((row) => row.id);
  const familyByDishId = new Map<string, MenuEngineeringDishFamily>();
  const kindByDishId = new Map<string, 'food' | 'drink' | null>();

  if (dishIds.length > 0) {
    const { data: dishesData, error: dishesError } = await supabase
      .from('cheffing_dishes')
      .select('id, mycheftool_source_tag_names, cheffing_families(kind)')
      .in('id', dishIds);

    if (dishesError) {
      throw new Error(dishesError.message);
    }

    for (const dish of dishesData ?? []) {
      const relation = Array.isArray(dish.cheffing_families) ? dish.cheffing_families[0] : dish.cheffing_families;
      kindByDishId.set(dish.id, relation?.kind ?? null);
      familyByDishId.set(
        dish.id,
        resolveDishFamilyFromSourceTags(Array.isArray(dish.mycheftool_source_tag_names) ? dish.mycheftool_source_tag_names : []),
      );
    }
  }

  const normalized = normalizeDateRange(range);
  const shouldFilterByDate = Boolean(normalized);
  const unitsSoldByDish = new Map<string, number>();

  if (normalized) {
    const [linksResult, salesResult] = await Promise.all([
      supabase.from('cheffing_pos_product_links').select('pos_product_id, dish_id'),
      supabase
        .from('cheffing_pos_sales_daily')
        .select('pos_product_id, units')
        .gte('sale_day', normalized.from)
        .lte('sale_day', normalized.to),
    ]);

    if (linksResult.error) {
      throw new Error(linksResult.error.message);
    }

    if (salesResult.error) {
      throw new Error(salesResult.error.message);
    }

    const dishByPosProduct = new Map<string, string>();
    for (const link of linksResult.data ?? []) {
      if (!link.dish_id || !link.pos_product_id) {
        continue;
      }

      dishByPosProduct.set(String(link.pos_product_id), String(link.dish_id));
    }

    for (const sale of salesResult.data ?? []) {
      if (!sale.pos_product_id) {
        continue;
      }

      const dishId = dishByPosProduct.get(String(sale.pos_product_id));
      if (!dishId) {
        continue;
      }

      const units = parseNumber(sale.units);
      unitsSoldByDish.set(dishId, (unitsSoldByDish.get(dishId) ?? 0) + units);
    }
  }

  const rows: MenuEngineeringRowBase[] =
    data?.map((row) => {
      const sellingPriceGross = toNumber(row.selling_price);
      const costPerServing = toNumber(row.cost_per_serving);
      const unitsSoldFromView = parseNumber(row.units_sold);
      const unitsSold = toFiniteNumber(shouldFilterByDate ? unitsSoldByDish.get(row.id) ?? 0 : unitsSoldFromView);
      const netPrice = getNetPriceFromGross(sellingPriceGross, vatRate);
      const marginUnit = netPrice !== null && costPerServing !== null ? netPrice - costPerServing : null;
      const cogsPct = netPrice !== null && netPrice > 0 && costPerServing !== null ? costPerServing / netPrice : null;
      const marginPct = netPrice !== null && netPrice > 0 && marginUnit !== null ? marginUnit / netPrice : null;
      const targetPvpGross25 = getMenuObjectivePvpGross(costPerServing, vatRate);
      const dif = sellingPriceGross !== null && targetPvpGross25 !== null ? sellingPriceGross - targetPvpGross25 : null;
      const totalSalesGross = sellingPriceGross !== null ? sellingPriceGross * unitsSold : 0;
      const totalSalesNet = netPrice !== null ? netPrice * unitsSold : null;
      const totalMargin = marginUnit !== null ? marginUnit * unitsSold : null;

      return {
        id: row.id,
        name: row.name,
        family: familyByDishId.get(row.id) ?? 'Sin familia',
        source: 'dish',
        selling_price_gross: sellingPriceGross,
        vat_rate: vatRate,
        units_sold: unitsSold,
        has_sales_data: true,
        cost_per_serving: costPerServing,
        net_price: netPrice,
        margin_unit: marginUnit,
        cogs_pct: cogsPct,
        margin_pct: marginPct,
        pvp_objetivo_gross: targetPvpGross25,
        dif,
        total_sales_gross: totalSalesGross,
        total_sales_net: totalSalesNet,
        total_margin: totalMargin,
      };
    }) ?? [];

  const kindFilter = view === 'bebidas' ? 'drink' : 'food';
  const sourceFilteredRows = rows.filter((row) => kindByDishId.get(row.id) === kindFilter);
  const availableFamilies = [...new Set(sourceFilteredRows.map((row) => row.family))].sort((a, b) => a.localeCompare(b, 'es'));
  const normalizedFamilyFilter = family && MENU_ENGINEERING_FAMILIES.includes(family) ? family : null;
  const filteredRows = normalizedFamilyFilter
    ? sourceFilteredRows.filter((row) => row.family === normalizedFamilyFilter)
    : sourceFilteredRows;

  const { rowsEnriched, pivots, stats } = computeBcm(filteredRows);

  return { rows: rowsEnriched, pivots, stats, availableFamilies };
}

async function getMenuEngineeringMenuRows(vatRate: MenuEngineeringVatRate) {
  const supabase = createSupabaseAdminClient();
  const [{ data: menus, error: menusError }, { data: menuItems, error: itemsError }, { data: dishCosts, error: dishCostsError }] =
    await Promise.all([
      supabase.from('cheffing_menus').select('id, name, price_per_person').order('name', { ascending: true }),
      supabase.from('cheffing_menu_items').select('menu_id, dish_id, multiplier, section_kind'),
      supabase.from('v_cheffing_dish_cost').select('id, name, items_cost_total'),
    ]);

  if (menusError || itemsError || dishCostsError) {
    throw new Error((menusError ?? itemsError ?? dishCostsError)?.message ?? 'No se pudo cargar menu engineering de menús.');
  }

  const dishById = new Map((dishCosts ?? []).map((dish) => [dish.id, dish]));
  const itemsByMenuId = new Map<string, (typeof menuItems)[number][]>();
  for (const item of menuItems ?? []) {
    if (!item.menu_id) continue;
    const list = itemsByMenuId.get(item.menu_id) ?? [];
    list.push(item);
    itemsByMenuId.set(item.menu_id, list);
  }

  const rows: MenuEngineeringRow[] = (menus ?? []).map((menu) => {
    const menuLines = (itemsByMenuId.get(menu.id) ?? []).map((item) => {
      const dish = dishById.get(item.dish_id);
      const multiplier = typeof item.multiplier === 'number' ? item.multiplier : 1;
      const dishCost = dish?.items_cost_total ?? null;
      const lineCost = dishCost === null ? null : Number((dishCost * multiplier).toFixed(4));

      return {
        section_kind: (item.section_kind ?? 'starter') as 'starter' | 'main' | 'drink' | 'dessert',
        lineName: dish?.name ?? 'Línea sin plato/bebida',
        cost: lineCost,
      };
    });

    const costDiagnostics = getMenuConservativeCostDiagnostics(menuLines);
    const sellingPriceGross = toNumber(menu.price_per_person);
    const netPrice = getNetPriceFromGross(sellingPriceGross, vatRate);
    const costPerServing = costDiagnostics.total;
    const marginUnit = netPrice !== null && costPerServing !== null ? netPrice - costPerServing : null;
    const cogsPct = netPrice !== null && netPrice > 0 && costPerServing !== null ? costPerServing / netPrice : null;
    const marginPct = netPrice !== null && netPrice > 0 && marginUnit !== null ? marginUnit / netPrice : null;
    const pvpObjetivo = getMenuObjectivePvpGross(costPerServing, vatRate);
    const dif = sellingPriceGross !== null && pvpObjetivo !== null ? sellingPriceGross - pvpObjetivo : null;

    return {
      id: menu.id,
      name: menu.name,
      family: 'Sin familia',
      source: 'menu',
      selling_price_gross: sellingPriceGross,
      vat_rate: vatRate,
      units_sold: 0,
      has_sales_data: false,
      cost_per_serving: costPerServing,
      net_price: netPrice,
      margin_unit: marginUnit,
      cogs_pct: cogsPct,
      margin_pct: marginPct,
      pvp_objetivo_gross: pvpObjetivo,
      dif,
      total_sales_gross: 0,
      total_sales_net: null,
      total_margin: null,
      bcm_margin_g: null,
      bcm_popularity_index: null,
      bcm_popularity_g: null,
      bcm: 'SIN_DATOS',
      high_popularity: false,
      high_margin: false,
    };
  });

  return {
    rows,
    pivots: { popularity: 0, margin: 0 },
    stats: {
      totalUnitsSold: 0,
      totalSales: 0,
      totalMargin: 0,
      dishCount: 0,
      marginAverage: 0,
      costProductPct: 0,
      popularityCorrectionPct: 0.7,
      popularityIndexAverage: 0,
    },
    availableFamilies: [] as MenuEngineeringDishFamily[],
  };
}
