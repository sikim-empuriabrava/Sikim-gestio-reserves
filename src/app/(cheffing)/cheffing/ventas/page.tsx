import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { VentasTabsClient } from './VentasTabsClient';

export default async function CheffingVentasPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();

  const [{ data: orders }, { data: items }, { data: links }, { data: dishes }] = await Promise.all([
    supabase
      .from('cheffing_pos_orders')
      .select('pos_order_id, opened_at, outlet_id, clients, total_gross, status, total_payments')
      .order('opened_at', { ascending: false })
      .limit(200),
    supabase
      .from('cheffing_pos_sales_daily')
      .select('pos_product_id, outlet_id, pos_product_name, units, revenue')
      .order('units', { ascending: false })
      .limit(200),
    supabase.from('cheffing_pos_product_links').select('pos_product_id, dish_id'),
    supabase.from('cheffing_dishes').select('id, name').order('name', { ascending: true }),
  ]);

  const dishById = new Map((dishes ?? []).map((dish) => [dish.id, dish.name]));
  const linkByPosProduct = new Map((links ?? []).map((link) => [link.pos_product_id, link.dish_id]));

  return (
    <VentasTabsClient
      initialOrders={(orders ?? []).map((order) => ({
        ...order,
        discount_gross: order.total_gross !== null && order.total_payments !== null ? order.total_gross - order.total_payments : null,
      }))}
      productRows={(items ?? []).map((row) => {
        const linkedDishId = linkByPosProduct.get(row.pos_product_id) ?? null;
        return {
          ...row,
          units: Number(row.units ?? 0),
          revenue: row.revenue === null ? null : Number(row.revenue),
          dish_id: linkedDishId,
          dish_name: linkedDishId ? (dishById.get(linkedDishId) ?? null) : null,
        };
      })}
      dishes={dishes ?? []}
    />
  );
}
