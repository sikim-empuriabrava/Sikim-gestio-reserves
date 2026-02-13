import { NextResponse } from 'next/server';

import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { parseCsvSemicolon, parseDateTime, parseDecimalEs, resolveHeaderMap } from '@/lib/cheffing/posCsv';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRow = {
  pos_order_id: string;
  outlet_id: string;
  outlet_name: string | null;
  opened_at: string;
  closed_at: string | null;
  custom_order_id: string | null;
  order_name: string | null;
  opened_by: string | null;
  closed_table: string | null;
  clients: number | null;
  duration_seconds: number | null;
  status: string | null;
  currency: string | null;
  total_gross: number | null;
  total_net: number | null;
  total_vat: number | null;
  total_payments: number | null;
};

type ItemRow = {
  pos_order_id: string;
  outlet_id: string;
  outlet_name: string | null;
  opened_at: string;
  closed_at: string | null;
  product_name: string;
  sku: string | null;
  gift_card_code: string | null;
  quantity: number;
  unit_price_gross: number;
  discount_gross: number;
  total_gross: number;
  total_net: number | null;
  vat_amount: number | null;
  currency: string | null;
};

const ORDER_HEADERS = {
  pos_order_id: ['ID pedido', 'Pedido ID', 'Order ID'],
  outlet_id: ['ID local', 'Local ID', 'Outlet ID'],
  outlet_name: ['Nombre local', 'Local', 'Outlet name'],
  opened_at: ['Fecha apertura', 'Open date', 'Opened at'],
  closed_at: ['Fecha cierre', 'Close date', 'Closed at'],
  custom_order_id: ['ID pedido personalizado', 'Custom order ID'],
  order_name: ['Nombre pedido', 'Order name'],
  opened_by: ['Abierto por', 'Opened by'],
  closed_table: ['Mesa cerrada', 'Closed table', 'Table'],
  clients: ['Clientes', 'Comensales', 'Customer count'],
  duration_seconds: ['Duración (s)', 'Duration seconds'],
  status: ['Estado', 'Payment status', 'Status'],
  currency: ['Moneda', 'Currency'],
  total_gross: ['Total bruto', 'Gross total'],
  total_net: ['Total neto', 'Net total'],
  total_vat: ['IVA total', 'VAT total'],
  total_payments: ['Total pagos', 'Total payments'],
} as const;

const ITEM_HEADERS = {
  pos_order_id: ['ID pedido', 'Pedido ID', 'Order ID'],
  outlet_id: ['ID local', 'Local ID', 'Outlet ID'],
  outlet_name: ['Nombre local', 'Local', 'Outlet name'],
  opened_at: ['Fecha apertura', 'Open date', 'Opened at'],
  closed_at: ['Fecha cierre', 'Close date', 'Closed at'],
  product_name: ['Producto', 'Nombre producto', 'Product name'],
  sku: ['SKU', 'Referencia'],
  gift_card_code: ['Código tarjeta regalo', 'Gift card code'],
  quantity: ['Cantidad', 'Units'],
  unit_price_gross: ['Precio unitario bruto', 'Unit gross price'],
  discount_gross: ['Descuento bruto', 'Gross discount'],
  total_gross: ['Total bruto', 'Gross total'],
  total_net: ['Total neto', 'Net total'],
  vat_amount: ['IVA', 'VAT amount'],
  currency: ['Moneda', 'Currency'],
} as const;

const getCell = (row: Record<string, string>, header: string) => row[header] ?? '';

const toDateOnly = (timestamp: string) => timestamp.slice(0, 10);

const buildItemDedupeKey = (row: ItemRow) =>
  `${row.pos_order_id}|${row.product_name}|${row.unit_price_gross.toFixed(4)}|${row.discount_gross.toFixed(4)}`;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const formData = await request.formData();
  const ordersFile = formData.get('orders_csv');
  const itemsFile = formData.get('items_csv');

  if (!(ordersFile instanceof File) && !(itemsFile instanceof File)) {
    const invalid = NextResponse.json({ error: 'Debes enviar al menos un CSV: orders_csv o items_csv.' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const warnings: string[] = [];
  const supabase = createSupabaseAdminClient();

  let orders: OrderRow[] = [];
  let items: ItemRow[] = [];

  if (ordersFile instanceof File) {
    const parsed = parseCsvSemicolon(await ordersFile.text());
    const headerMap = resolveHeaderMap(parsed.headers, ORDER_HEADERS);

    if (headerMap.missing.length > 0) {
      const invalid = NextResponse.json(
        { error: 'Faltan columnas en orders_csv.', missingHeaders: headerMap.missing },
        { status: 400 },
      );
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    orders = parsed.rows
      .map((raw) => {
        const posOrderId = getCell(raw, headerMap.resolved.pos_order_id).trim();
        const openedAt = parseDateTime(getCell(raw, headerMap.resolved.opened_at));

        if (!posOrderId || !openedAt) {
          return null;
        }

        return {
          pos_order_id: posOrderId,
          outlet_id: getCell(raw, headerMap.resolved.outlet_id).trim() || 'default',
          outlet_name: getCell(raw, headerMap.resolved.outlet_name).trim() || null,
          opened_at: openedAt,
          closed_at: parseDateTime(getCell(raw, headerMap.resolved.closed_at)),
          custom_order_id: getCell(raw, headerMap.resolved.custom_order_id).trim() || null,
          order_name: getCell(raw, headerMap.resolved.order_name).trim() || null,
          opened_by: getCell(raw, headerMap.resolved.opened_by).trim() || null,
          closed_table: getCell(raw, headerMap.resolved.closed_table).trim() || null,
          clients: Number.parseInt(getCell(raw, headerMap.resolved.clients), 10) || null,
          duration_seconds: Number.parseInt(getCell(raw, headerMap.resolved.duration_seconds), 10) || null,
          status: getCell(raw, headerMap.resolved.status).trim() || null,
          currency: getCell(raw, headerMap.resolved.currency).trim() || null,
          total_gross: parseDecimalEs(getCell(raw, headerMap.resolved.total_gross)),
          total_net: parseDecimalEs(getCell(raw, headerMap.resolved.total_net)),
          total_vat: parseDecimalEs(getCell(raw, headerMap.resolved.total_vat)),
          total_payments: parseDecimalEs(getCell(raw, headerMap.resolved.total_payments)),
        } satisfies OrderRow;
      })
      .filter((row): row is OrderRow => row !== null);
  }

  if (itemsFile instanceof File) {
    const parsed = parseCsvSemicolon(await itemsFile.text());
    const headerMap = resolveHeaderMap(parsed.headers, ITEM_HEADERS);

    if (headerMap.missing.length > 0) {
      const invalid = NextResponse.json(
        { error: 'Faltan columnas en items_csv.', missingHeaders: headerMap.missing },
        { status: 400 },
      );
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    items = parsed.rows
      .map((raw) => {
        const posOrderId = getCell(raw, headerMap.resolved.pos_order_id).trim();
        const openedAt = parseDateTime(getCell(raw, headerMap.resolved.opened_at));
        const productName = getCell(raw, headerMap.resolved.product_name).trim();

        if (!posOrderId || !openedAt || !productName) {
          return null;
        }

        return {
          pos_order_id: posOrderId,
          outlet_id: getCell(raw, headerMap.resolved.outlet_id).trim() || 'default',
          outlet_name: getCell(raw, headerMap.resolved.outlet_name).trim() || null,
          opened_at: openedAt,
          closed_at: parseDateTime(getCell(raw, headerMap.resolved.closed_at)),
          product_name: productName,
          sku: getCell(raw, headerMap.resolved.sku).trim() || null,
          gift_card_code: getCell(raw, headerMap.resolved.gift_card_code).trim() || null,
          quantity: parseDecimalEs(getCell(raw, headerMap.resolved.quantity)) ?? 0,
          unit_price_gross: parseDecimalEs(getCell(raw, headerMap.resolved.unit_price_gross)) ?? 0,
          discount_gross: parseDecimalEs(getCell(raw, headerMap.resolved.discount_gross)) ?? 0,
          total_gross: parseDecimalEs(getCell(raw, headerMap.resolved.total_gross)) ?? 0,
          total_net: parseDecimalEs(getCell(raw, headerMap.resolved.total_net)),
          vat_amount: parseDecimalEs(getCell(raw, headerMap.resolved.vat_amount)),
          currency: getCell(raw, headerMap.resolved.currency).trim() || null,
        } satisfies ItemRow;
      })
      .filter((row): row is ItemRow => row !== null);
  }

  const ordersById = new Map<string, OrderRow>();
  for (const order of orders) {
    ordersById.set(order.pos_order_id, order);
  }
  const dedupedOrders = Array.from(ordersById.values());

  const itemRollup = new Map<string, ItemRow>();
  for (const item of items) {
    const dedupe = buildItemDedupeKey(item);
    const existing = itemRollup.get(dedupe);
    if (!existing) {
      itemRollup.set(dedupe, { ...item });
      continue;
    }

    existing.quantity += item.quantity;
    existing.total_gross += item.total_gross;
    existing.total_net = (existing.total_net ?? 0) + (item.total_net ?? 0);
    existing.vat_amount = (existing.vat_amount ?? 0) + (item.vat_amount ?? 0);
  }
  const dedupedItems = Array.from(itemRollup.values());

  let ordersInserted = 0;
  let ordersUpdated = 0;
  if (dedupedOrders.length > 0) {
    const orderIds = dedupedOrders.map((row) => row.pos_order_id);
    const { data: existingOrders, error: existingOrdersError } = await supabase
      .from('cheffing_pos_orders')
      .select('pos_order_id, opened_at')
      .in('pos_order_id', orderIds);

    if (existingOrdersError) {
      const failed = NextResponse.json({ error: existingOrdersError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, failed);
      return failed;
    }

    const existingMap = new Map((existingOrders ?? []).map((row) => [row.pos_order_id, row.opened_at]));

    for (const row of dedupedOrders) {
      const existing = existingMap.get(row.pos_order_id);
      if (!existing) {
        ordersInserted += 1;
        continue;
      }
      ordersUpdated += 1;
      const existingTs = new Date(existing).getTime();
      const importedTs = new Date(row.opened_at.replace(' ', 'T')).getTime();
      if (Number.isFinite(existingTs) && Number.isFinite(importedTs) && existingTs !== importedTs) {
        warnings.push(`Pedido ${row.pos_order_id} ya existía con opened_at distinto (${existing}).`);
      }
    }

    const { error: upsertOrdersError } = await supabase
      .from('cheffing_pos_orders')
      .upsert(dedupedOrders, { onConflict: 'pos_order_id' });

    if (upsertOrdersError) {
      const failed = NextResponse.json({ error: upsertOrdersError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, failed);
      return failed;
    }
  }

  let itemsInserted = 0;
  let itemsUpdated = 0;
  if (dedupedItems.length > 0) {
    const orderIds = Array.from(new Set(dedupedItems.map((row) => row.pos_order_id)));
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('cheffing_pos_order_items')
      .select('pos_order_id, product_name, unit_price_gross, discount_gross')
      .in('pos_order_id', orderIds);

    if (existingItemsError) {
      const failed = NextResponse.json({ error: existingItemsError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, failed);
      return failed;
    }

    const existingKeys = new Set(
      (existingItems ?? []).map(
        (row) =>
          `${row.pos_order_id}|${row.product_name}|${Number(row.unit_price_gross).toFixed(4)}|${Number(row.discount_gross).toFixed(4)}`,
      ),
    );

    for (const row of dedupedItems) {
      if (existingKeys.has(buildItemDedupeKey(row))) {
        itemsUpdated += 1;
      } else {
        itemsInserted += 1;
      }
    }

    const { error: upsertItemsError } = await supabase.from('cheffing_pos_order_items').upsert(dedupedItems, {
      onConflict: 'pos_order_id,product_name,unit_price_gross,discount_gross',
    });

    if (upsertItemsError) {
      const failed = NextResponse.json({ error: upsertItemsError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, failed);
      return failed;
    }
  }

  const dateCandidates = [...dedupedOrders.map((row) => row.opened_at), ...dedupedItems.map((row) => row.opened_at)].sort();
  const dateRange =
    dateCandidates.length > 0
      ? {
          from: toDateOnly(dateCandidates[0]),
          to: toDateOnly(dateCandidates[dateCandidates.length - 1]),
        }
      : null;

  if (dateRange) {
    const { error: refreshError } = await supabase.rpc('cheffing_pos_refresh_sales_daily', {
      p_from: dateRange.from,
      p_to: dateRange.to,
    });

    if (refreshError) {
      warnings.push(`No se pudo refrescar cheffing_pos_sales_daily: ${refreshError.message}`);
    }
  }

  const response = NextResponse.json({
    ok: true,
    orders: { inserted: ordersInserted, updated: ordersUpdated, total: dedupedOrders.length },
    items: { inserted: itemsInserted, updated: itemsUpdated, total: dedupedItems.length },
    dateRange,
    warnings,
    durationMs: Date.now() - startedAt,
  });

  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
