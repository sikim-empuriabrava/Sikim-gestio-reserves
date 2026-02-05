import { NextRequest, NextResponse } from 'next/server';

import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_IVA = 0.1;

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const parseDateRange = (searchParams: URLSearchParams) => {
  const today = new Date();
  const defaultTo = formatDate(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 30);
  const defaultFrom = formatDate(startDate);

  return {
    from: searchParams.get('from') ?? defaultFrom,
    to: searchParams.get('to') ?? defaultTo,
  };
};

const parseIva = (searchParams: URLSearchParams) => {
  const raw = searchParams.get('iva');
  if (!raw) {
    return DEFAULT_IVA;
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_IVA;
  }
  return parsed;
};

const toNumber = (value: number | null) => (value === null || Number.isNaN(value) ? null : value);

export async function GET(req: NextRequest) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const { from, to } = parseDateRange(req.nextUrl.searchParams);
  const iva = parseIva(req.nextUrl.searchParams);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, servings, items_cost_total, cost_per_serving')
    .order('name', { ascending: true });

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const rows =
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

  const response = NextResponse.json({ meta: { from, to, iva }, rows });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
