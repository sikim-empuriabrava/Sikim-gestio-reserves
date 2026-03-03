import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { type MenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';

export type MenuEngineeringRow = {
  id: string;
  name: string;
  selling_price_gross: number | null;
  vat_rate: number;
  units_sold: number;
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
};

type NormalizedDateRange = { from: string; to: string };

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

export async function getMenuEngineeringRows(
  vatRate: MenuEngineeringVatRate,
  range?: { from?: string; to?: string },
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_menu_engineering_dish_cost')
    .select('id, name, selling_price, cost_per_serving, units_sold')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
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

  const rows: MenuEngineeringRow[] =
    data?.map((row) => {
      const sellingPriceGross = toNumber(row.selling_price);
      const costPerServing = toNumber(row.cost_per_serving);
      const unitsSoldFromView = toNumber(row.units_sold) ?? 0;
      const unitsSold = shouldFilterByDate ? unitsSoldByDish.get(row.id) ?? 0 : unitsSoldFromView;
      const netPrice =
        sellingPriceGross !== null ? (vatRate === 0 ? sellingPriceGross : sellingPriceGross / (1 + vatRate)) : null;
      const marginUnit = netPrice !== null && costPerServing !== null ? netPrice - costPerServing : null;
      const cogsPct = netPrice !== null && netPrice > 0 && costPerServing !== null ? costPerServing / netPrice : null;
      const marginPct = netPrice !== null && netPrice > 0 && marginUnit !== null ? marginUnit / netPrice : null;
      const targetPvpGross25 = costPerServing !== null ? costPerServing * 4 * (1 + vatRate) : null;
      const dif = sellingPriceGross !== null && targetPvpGross25 !== null ? sellingPriceGross - targetPvpGross25 : null;
      const totalSalesGross = sellingPriceGross !== null ? sellingPriceGross * unitsSold : 0;
      const totalSalesNet = netPrice !== null ? netPrice * unitsSold : null;
      const totalMargin = marginUnit !== null ? marginUnit * unitsSold : null;

      return {
        id: row.id,
        name: row.name,
        selling_price_gross: sellingPriceGross,
        vat_rate: vatRate,
        units_sold: unitsSold,
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

  return { rows };
}
