import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type MenuEngineeringRow = {
  id: string;
  name: string;
  selling_price: number | null;
  cost_per_serving: number | null;
  net_price: number | null;
  margin_unit: number | null;
  food_cost_pct: number | null;
  target_pvp_net_25: number | null;
  target_pvp_gross_25: number | null;
};

const toNumber = (value: number | null) => (value === null || Number.isNaN(value) ? null : value);

export async function getMenuEngineeringRows(iva: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, cost_per_serving')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows: MenuEngineeringRow[] =
    data?.map((row) => {
      const sellingPrice = toNumber(row.selling_price);
      const costPerServing = toNumber(row.cost_per_serving);
      const netPrice = sellingPrice !== null ? sellingPrice / (1 + iva) : null;
      const marginUnit = netPrice !== null && costPerServing !== null ? netPrice - costPerServing : null;
      const foodCostPct = netPrice !== null && netPrice > 0 && costPerServing !== null ? costPerServing / netPrice : null;
      const targetPvpNet25 = costPerServing !== null ? costPerServing / 0.25 : null;
      const targetPvpGross25 = targetPvpNet25 !== null ? targetPvpNet25 * (1 + iva) : null;

      return {
        id: row.id,
        name: row.name,
        selling_price: sellingPrice,
        cost_per_serving: costPerServing,
        net_price: netPrice,
        margin_unit: marginUnit,
        food_cost_pct: foodCostPct,
        target_pvp_net_25: targetPvpNet25,
        target_pvp_gross_25: targetPvpGross25,
      };
    }) ?? [];

  return { rows };
}
