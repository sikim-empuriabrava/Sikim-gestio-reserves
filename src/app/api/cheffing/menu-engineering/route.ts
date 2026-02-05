import { NextRequest, NextResponse } from 'next/server';

import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { getMenuEngineeringRows } from '@/lib/cheffing/menuEngineering';
import { normalizeMenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(req: NextRequest) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const { from, to } = parseDateRange(req.nextUrl.searchParams);
  const vatRate = normalizeMenuEngineeringVatRate(req.nextUrl.searchParams.get('iva'));

  let rows = [];
  try {
    const result = await getMenuEngineeringRows(vatRate);
    rows = result.rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load menu engineering data';
    const serverError = NextResponse.json({ error: message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ meta: { from, to, iva: vatRate }, rows });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
