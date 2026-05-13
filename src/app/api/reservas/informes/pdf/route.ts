import { createElement } from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { ReservationReportPdf } from '@/lib/server/reservation-reports/ReservationReportPdf';
import {
  buildPdfFileName,
  DATE_REGEX,
  getRangeValidation,
  getReportData,
  todayISO,
} from '@/lib/server/reservation-reports/reportData';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

function getRangeParams(req: NextRequest): { from: string; to: string } | { error: string } {
  const params = req.nextUrl.searchParams;
  const today = todayISO();
  const fromParam = params.get('desde') ?? params.get('from') ?? undefined;
  const toParam = params.get('hasta') ?? params.get('to') ?? undefined;

  if (fromParam !== undefined && !DATE_REGEX.test(fromParam)) {
    return { error: 'Fecha desde inválida. Usa formato YYYY-MM-DD.' };
  }

  const from = fromParam ?? today;

  if (toParam !== undefined && !DATE_REGEX.test(toParam)) {
    return { error: 'Fecha hasta inválida. Usa formato YYYY-MM-DD.' };
  }

  const to = toParam ?? from;

  return { from, to };
}

export async function GET(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = jsonError('Unauthorized', 401);
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const requesterEmail = user.email?.trim().toLowerCase();
  if (!requesterEmail) {
    const notAllowed = jsonError('Not allowed', 403);
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = jsonError('Allowlist check failed', 500);
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  const canDownloadReport =
    allowlistInfo.allowlisted &&
    allowlistInfo.allowedUser?.is_active &&
    (isAdmin(allowlistInfo.role) || Boolean(allowlistInfo.allowedUser.can_reservas));

  if (!canDownloadReport) {
    const forbidden = jsonError('Forbidden', 403);
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const rangeParams = getRangeParams(req);
  if ('error' in rangeParams) {
    const invalid = jsonError(rangeParams.error, 400);
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  const { from, to } = rangeParams;
  const validation = getRangeValidation(from, to);
  if (!validation.valid) {
    const invalid = jsonError(validation.message, 400);
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  try {
    const generatedAt = new Date();
    const reportData = await getReportData(from, to);
    if (reportData.reservations.length === 0) {
      const empty = jsonError('No hay reservas confirmadas o completadas en este rango.', 404);
      mergeResponseCookies(supabaseResponse, empty);
      return empty;
    }

    const pdfDocument = createElement(ReservationReportPdf, {
      reportData,
      from,
      to,
      generatedAt,
    }) as Parameters<typeof renderToBuffer>[0];
    const pdfBuffer = await renderToBuffer(pdfDocument);
    const response = new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildPdfFileName(from, to)}"`,
        'Cache-Control': 'no-store',
      },
    });
    mergeResponseCookies(supabaseResponse, response);
    return response;
  } catch (error) {
    console.error('[reservas/informes/pdf] Failed to generate PDF', error);
    const serverError = jsonError('No se pudo generar el PDF del informe.', 500);
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }
}
