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

const ORDER_REQUIRED_HEADERS = {
  pos_order_id: ['ID pedido', 'Pedido ID', 'Order ID'],
  outlet_id: ['ID Establecimiento', 'ID local', 'Local ID', 'Outlet ID'],
  opened_at: ['Fecha de apertura', 'Fecha apertura', 'Open date', 'Opened at'],
} as const;

const ORDER_OPTIONAL_HEADERS = {
  outlet_name: ['Establecimiento', 'Nombre local', 'Local', 'Outlet name'],
  closed_at: ['Fecha de cierre', 'Fecha cierre', 'Close date', 'Closed at'],
  custom_order_id: ['ID pedido personalizado', 'Custom order ID'],
  order_name: ['Nombre del pedido', 'Nombre pedido', 'Order name'],
  opened_by: ['Abierto por el usuario', 'Abierto por', 'Opened by'],
  closed_table: ['Cerrado en mesa', 'Mesa cerrada', 'Closed table', 'Table'],
  clients: ['Numero de clientes', 'Clientes', 'Comensales', 'Customer count'],
  duration_seconds: ['Duracion del pedido', 'Duración del pedido', 'Duración (s)', 'Duration seconds'],
  status: ['Estado del pedido', 'Estado', 'Payment status', 'Status'],
  currency: ['Moneda', 'Currency'],
  total_gross: ['Facturacion con IVA', 'Total bruto', 'Gross total'],
  total_net: ['Facturacion sin IVA', 'Total neto', 'Net total'],
  total_vat: ['Total IVA aplicado', 'IVA total', 'VAT total'],
  total_payments: ['Total cobros', 'Importe pagado', 'Total pagos', 'Total payments'],
} as const;

const ITEM_REQUIRED_HEADERS = {
  pos_order_id: ['ID pedido', 'Pedido ID', 'Order ID'],
  outlet_id: ['ID Establecimiento', 'ID local', 'Local ID', 'Outlet ID'],
  opened_at: ['Fecha de apertura', 'Fecha apertura', 'Open date', 'Opened at'],
  product_name: ['Producto', 'Nombre producto', 'Product name'],
  quantity: ['Cantidad', 'Units'],
  unit_price_gross: ['Precio unitario IVA incluido', 'Precio unitario bruto', 'Unit gross price'],
  total_gross: ['Facturacion con IVA', 'Total bruto', 'Gross total'],
} as const;

const ITEM_OPTIONAL_HEADERS = {
  outlet_name: ['Establecimiento', 'Nombre local', 'Local', 'Outlet name'],
  closed_at: ['Fecha de cierre', 'Fecha cierre', 'Close date', 'Closed at'],
  sku: ['SKU', 'Referencia'],
  gift_card_code: ['Código tarjeta regalo', 'Codigo tarjeta regalo', 'Gift card code'],
  discount_gross: ['Descuento', 'Descuento bruto', 'Gross discount'],
  total_net: ['Facturacion sin IVA', 'Total neto', 'Net total'],
  vat_amount: ['IVA aplicado', 'IVA', 'VAT amount'],
  currency: ['Moneda', 'Currency'],
} as const;

const getCell = (row: Record<string, string>, header?: string | null) => (header ? (row[header] ?? '') : '');

const findOptionalHeader = (headers: string[], aliases: readonly string[]) => {
  const optionalMap = resolveHeaderMap(headers, { optional: aliases });
  return optionalMap.resolved.optional ?? null;
};

const toDateOnly = (timestamp: string) => timestamp.slice(0, 10);

const dayAfter = (dateStrYYYYMMDD: string) => {
  const [year, month, day] = dateStrYYYYMMDD.split('-').map((part) => Number.parseInt(part, 10));
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = String(nextDay.getUTCFullYear());
  const nextMonth = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
  const nextDate = String(nextDay.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDate}`;
};

const parseDurationToSeconds = (value: string | null | undefined): number | null => {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const timeParts = normalized.split(':').map((part) => part.trim());
  if (timeParts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  if (timeParts.length === 3) {
    const [hours, minutes, seconds] = timeParts.map((part) => Number.parseInt(part, 10));
    return hours * 3600 + minutes * 60 + seconds;
  }

  if (timeParts.length === 2) {
    const [minutes, seconds] = timeParts.map((part) => Number.parseInt(part, 10));
    return minutes * 60 + seconds;
  }

  return null;
};

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

  if (!(ordersFile instanceof File) || !(itemsFile instanceof File)) {
    const invalid = NextResponse.json(
      { error: 'En modo overwrite debes subir orders_csv (totales) y items_csv (por producto) a la vez.' },
      { status: 400 },
    );
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const warnings: string[] = [];
  const supabase = createSupabaseAdminClient();

  let orders: OrderRow[] = [];
  let items: ItemRow[] = [];

  if (ordersFile instanceof File) {
    const parsed = parseCsvSemicolon(await ordersFile.text());

    if (parsed.headers.length === 0) {
      const invalid = NextResponse.json({ error: 'CSV vacío o sin cabeceras.' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    const requiredHeaderMap = resolveHeaderMap(parsed.headers, ORDER_REQUIRED_HEADERS);

    if (requiredHeaderMap.missing.length > 0) {
      const invalid = NextResponse.json(
        { error: 'Faltan columnas requeridas en orders_csv.', missingHeaders: requiredHeaderMap.missing },
        { status: 400 },
      );
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    const optionalHeaders = Object.fromEntries(
      Object.entries(ORDER_OPTIONAL_HEADERS).map(([field, aliases]) => [field, findOptionalHeader(parsed.headers, aliases)]),
    ) as Record<keyof typeof ORDER_OPTIONAL_HEADERS, string | null>;

    orders = parsed.rows
      .map((raw) => {
        const posOrderId = getCell(raw, requiredHeaderMap.resolved.pos_order_id).trim();
        const openedAt = parseDateTime(getCell(raw, requiredHeaderMap.resolved.opened_at));

        if (!posOrderId || !openedAt) {
          return null;
        }

        return {
          pos_order_id: posOrderId,
          outlet_id: getCell(raw, requiredHeaderMap.resolved.outlet_id).trim() || 'default',
          outlet_name: getCell(raw, optionalHeaders.outlet_name).trim() || null,
          opened_at: openedAt,
          closed_at: parseDateTime(getCell(raw, optionalHeaders.closed_at)),
          custom_order_id: getCell(raw, optionalHeaders.custom_order_id).trim() || null,
          order_name: getCell(raw, optionalHeaders.order_name).trim() || null,
          opened_by: getCell(raw, optionalHeaders.opened_by).trim() || null,
          closed_table: getCell(raw, optionalHeaders.closed_table).trim() || null,
          clients: Number.parseInt(getCell(raw, optionalHeaders.clients), 10) || null,
          duration_seconds: parseDurationToSeconds(getCell(raw, optionalHeaders.duration_seconds)),
          status: getCell(raw, optionalHeaders.status).trim() || null,
          currency: getCell(raw, optionalHeaders.currency).trim() || null,
          total_gross: parseDecimalEs(getCell(raw, optionalHeaders.total_gross)),
          total_net: parseDecimalEs(getCell(raw, optionalHeaders.total_net)),
          total_vat: parseDecimalEs(getCell(raw, optionalHeaders.total_vat)),
          total_payments: parseDecimalEs(getCell(raw, optionalHeaders.total_payments)),
        } satisfies OrderRow;
      })
      .filter((row): row is OrderRow => row !== null);
  }

  if (itemsFile instanceof File) {
    const parsed = parseCsvSemicolon(await itemsFile.text());

    if (parsed.headers.length === 0) {
      const invalid = NextResponse.json({ error: 'CSV vacío o sin cabeceras.' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    const requiredHeaderMap = resolveHeaderMap(parsed.headers, ITEM_REQUIRED_HEADERS);

    if (requiredHeaderMap.missing.length > 0) {
      const invalid = NextResponse.json(
        { error: 'Faltan columnas requeridas en items_csv.', missingHeaders: requiredHeaderMap.missing },
        { status: 400 },
      );
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    const optionalHeaders = Object.fromEntries(
      Object.entries(ITEM_OPTIONAL_HEADERS).map(([field, aliases]) => [field, findOptionalHeader(parsed.headers, aliases)]),
    ) as Record<keyof typeof ITEM_OPTIONAL_HEADERS, string | null>;

    items = parsed.rows
      .map((raw) => {
        const posOrderId = getCell(raw, requiredHeaderMap.resolved.pos_order_id).trim();
        const openedAt = parseDateTime(getCell(raw, requiredHeaderMap.resolved.opened_at));
        const productName = getCell(raw, requiredHeaderMap.resolved.product_name).trim();

        if (!posOrderId || !openedAt || !productName) {
          return null;
        }

        return {
          pos_order_id: posOrderId,
          outlet_id: getCell(raw, requiredHeaderMap.resolved.outlet_id).trim() || 'default',
          outlet_name: getCell(raw, optionalHeaders.outlet_name).trim() || null,
          opened_at: openedAt,
          closed_at: parseDateTime(getCell(raw, optionalHeaders.closed_at)),
          product_name: productName,
          sku: getCell(raw, optionalHeaders.sku).trim() || null,
          gift_card_code: getCell(raw, optionalHeaders.gift_card_code).trim() || null,
          quantity: parseDecimalEs(getCell(raw, requiredHeaderMap.resolved.quantity)) ?? 0,
          unit_price_gross: parseDecimalEs(getCell(raw, requiredHeaderMap.resolved.unit_price_gross)) ?? 0,
          discount_gross: parseDecimalEs(getCell(raw, optionalHeaders.discount_gross)) ?? 0,
          total_gross: parseDecimalEs(getCell(raw, requiredHeaderMap.resolved.total_gross)) ?? 0,
          total_net: parseDecimalEs(getCell(raw, optionalHeaders.total_net)),
          vat_amount: parseDecimalEs(getCell(raw, optionalHeaders.vat_amount)),
          currency: getCell(raw, optionalHeaders.currency).trim() || null,
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

  if (dedupedOrders.length === 0 || dedupedItems.length === 0) {
    const invalid = NextResponse.json({ error: 'CSV sin datos importables' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const dateCandidates = [...dedupedOrders, ...dedupedItems].map((row) => toDateOnly(row.opened_at)).sort();
  const orderDateCandidates = dedupedOrders.map((row) => toDateOnly(row.opened_at)).sort();
  const itemDateCandidates = dedupedItems.map((row) => toDateOnly(row.opened_at)).sort();
  const ordersRange = {
    from: orderDateCandidates[0],
    to: orderDateCandidates[orderDateCandidates.length - 1],
  };
  const itemsRange = {
    from: itemDateCandidates[0],
    to: itemDateCandidates[itemDateCandidates.length - 1],
  };

  if (ordersRange.from !== itemsRange.from || ordersRange.to !== itemsRange.to) {
    warnings.push(
      `ATENCIÓN: orders_csv e items_csv cubren rangos distintos de Fecha de apertura. orders_csv=${ordersRange.from}→${ordersRange.to}; items_csv=${itemsRange.from}→${itemsRange.to}. Se seguirá con el rango combinado para evitar incoherencias, revisa los CSV antes del siguiente import.`,
    );
  }

  const dateRange = {
    from: dateCandidates[0],
    to: dateCandidates[dateCandidates.length - 1],
  };

  const fromTs = `${dateRange.from} 00:00:00`;
  const toExclusiveTs = `${dayAfter(dateRange.to)} 00:00:00`;

  const { count: deletedItemsCount, error: deleteItemsError } = await supabase
    .from('cheffing_pos_order_items')
    .delete({ count: 'exact' })
    .gte('opened_at', fromTs)
    .lt('opened_at', toExclusiveTs);

  if (deleteItemsError) {
    const failed = NextResponse.json({ error: deleteItemsError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, failed);
    return failed;
  }

  const { count: deletedOrdersCount, error: deleteOrdersError } = await supabase
    .from('cheffing_pos_orders')
    .delete({ count: 'exact' })
    .gte('opened_at', fromTs)
    .lt('opened_at', toExclusiveTs);

  if (deleteOrdersError) {
    const failed = NextResponse.json({ error: deleteOrdersError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, failed);
    return failed;
  }

  const { error: upsertOrdersError } = await supabase.from('cheffing_pos_orders').upsert(dedupedOrders, {
    onConflict: 'pos_order_id',
  });

  if (upsertOrdersError) {
    const failed = NextResponse.json({ error: upsertOrdersError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, failed);
    return failed;
  }

  const { error: upsertItemsError } = await supabase.from('cheffing_pos_order_items').upsert(dedupedItems, {
    onConflict: 'pos_order_id,product_name,unit_price_gross,discount_gross',
  });

  if (upsertItemsError) {
    const failed = NextResponse.json({ error: upsertItemsError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, failed);
    return failed;
  }

  const { count: deletedSalesDailyCount, error: deleteSalesDailyError } = await supabase
    .from('cheffing_pos_sales_daily')
    .delete({ count: 'exact' })
    .gte('sale_day', dateRange.from)
    .lte('sale_day', dateRange.to)
    .eq('source', 'csv');

  if (deleteSalesDailyError) {
    const failed = NextResponse.json({ error: deleteSalesDailyError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, failed);
    return failed;
  }

  const { error: refreshError } = await supabase.rpc('cheffing_pos_refresh_sales_daily', {
    p_from: dateRange.from,
    p_to: dateRange.to,
  });

  if (refreshError) {
    warnings.push(`No se pudo refrescar cheffing_pos_sales_daily: ${refreshError.message}`);
  }

  const ordersInserted = dedupedOrders.length;
  const ordersUpdated = 0;
  const itemsInserted = dedupedItems.length;
  const itemsUpdated = 0;

  const response = NextResponse.json({
    ok: true,
    mode: 'overwrite_by_csv_date_range',
    deleted: { orders: deletedOrdersCount ?? 0, items: deletedItemsCount ?? 0, sales_daily: deletedSalesDailyCount ?? 0 },
    orders: { inserted: ordersInserted, updated: ordersUpdated, total: dedupedOrders.length },
    items: { inserted: itemsInserted, updated: itemsUpdated, total: dedupedItems.length },
    dateRange,
    warnings,
    durationMs: Date.now() - startedAt,
  });

  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
