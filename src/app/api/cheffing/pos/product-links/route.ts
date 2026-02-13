import { NextRequest, NextResponse } from 'next/server';

import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action : '';
  const supabase = createSupabaseAdminClient();

  if (action === 'auto-match') {
    const { data: dishes, error: dishesError } = await supabase.from('cheffing_dishes').select('id, name');
    if (dishesError) {
      const failed = NextResponse.json({ error: dishesError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, failed);
      return failed;
    }

    const { data: products, error: productsError } = await supabase
      .from('cheffing_pos_sales_daily')
      .select('pos_product_id, pos_product_name')
      .not('pos_product_name', 'is', null);

    if (productsError) {
      const failed = NextResponse.json({ error: productsError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, failed);
      return failed;
    }

    const dishMap = new Map((dishes ?? []).map((dish) => [dish.name.trim(), dish.id]));

    const payload = Array.from(
      new Map(
        (products ?? [])
          .map((product) => {
            const dishId = product.pos_product_name ? dishMap.get(product.pos_product_name.trim()) : undefined;
            if (!dishId) {
              return null;
            }
            return [product.pos_product_id, { pos_product_id: product.pos_product_id, dish_id: dishId }] as const;
          })
          .filter((entry): entry is readonly [string, { pos_product_id: string; dish_id: string }] => entry !== null),
      ).values(),
    );

    if (payload.length === 0) {
      const response = NextResponse.json({ ok: true, matched: 0 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }

    const { error: upsertError } = await supabase
      .from('cheffing_pos_product_links')
      .upsert(payload, { onConflict: 'pos_product_id' });

    if (upsertError) {
      const failed = NextResponse.json({ error: upsertError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, failed);
      return failed;
    }

    const response = NextResponse.json({ ok: true, matched: payload.length });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (action === 'link-manual') {
    const posProductId = typeof body?.posProductId === 'string' ? body.posProductId : '';
    const dishId = typeof body?.dishId === 'string' ? body.dishId : '';

    if (!posProductId || !dishId) {
      const invalid = NextResponse.json({ error: 'posProductId y dishId son obligatorios.' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    const { error: upsertError } = await supabase
      .from('cheffing_pos_product_links')
      .upsert({ pos_product_id: posProductId, dish_id: dishId }, { onConflict: 'pos_product_id' });

    if (upsertError) {
      const failed = NextResponse.json({ error: upsertError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, failed);
      return failed;
    }

    const response = NextResponse.json({ ok: true });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const invalid = NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
  mergeResponseCookies(access.supabaseResponse, invalid);
  return invalid;
}
