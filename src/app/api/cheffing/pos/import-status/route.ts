import { NextResponse } from 'next/server';

import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const toDateOnly = (timestamp: string) => timestamp.slice(0, 10);

export async function GET() {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();

  const { data: lastOrderData, error: lastOrderError } = await supabase
    .from('cheffing_pos_orders')
    .select('pos_order_id, opened_at')
    .order('opened_at', { ascending: false })
    .order('pos_order_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOrderError) {
    const failed = NextResponse.json({ error: lastOrderError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, failed);
    return failed;
  }

  const { data: minRows, error: minError } = await supabase
    .from('cheffing_pos_orders')
    .select('opened_at')
    .order('opened_at', { ascending: true })
    .limit(1);

  if (minError) {
    const failed = NextResponse.json({ error: minError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, failed);
    return failed;
  }

  const { data: maxRows, error: maxError } = await supabase
    .from('cheffing_pos_orders')
    .select('opened_at')
    .order('opened_at', { ascending: false })
    .limit(1);

  if (maxError) {
    const failed = NextResponse.json({ error: maxError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, failed);
    return failed;
  }

  const minOpenedAt = minRows?.[0]?.opened_at ?? null;
  const maxOpenedAt = maxRows?.[0]?.opened_at ?? null;

  const response = NextResponse.json({
    ok: true,
    lastOrder: lastOrderData
      ? {
          pos_order_id: lastOrderData.pos_order_id,
          opened_at: lastOrderData.opened_at,
        }
      : null,
    range:
      minOpenedAt && maxOpenedAt
        ? {
            from: toDateOnly(minOpenedAt),
            to: toDateOnly(maxOpenedAt),
          }
        : null,
  });

  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
