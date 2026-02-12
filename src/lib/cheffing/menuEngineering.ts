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

const toNumber = (value: number | null) => (value === null || Number.isNaN(value) ? null : value);

export async function getMenuEngineeringRows(vatRate: MenuEngineeringVatRate) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_menu_engineering_dish_cost')
    .select('id, name, selling_price, cost_per_serving, units_sold')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows: MenuEngineeringRow[] =
    data?.map((row) => {
      const sellingPriceGross = toNumber(row.selling_price);
      const costPerServing = toNumber(row.cost_per_serving);
      const unitsSold = toNumber(row.units_sold) ?? 0;
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
