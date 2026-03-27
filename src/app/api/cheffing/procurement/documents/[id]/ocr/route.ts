import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { normalizeProcurementCanonicalUnit, normalizeProcurementText, type ProcurementCanonicalUnit } from '@/lib/cheffing/procurement';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr';

type OcrSupplierDetected = {
  name: string | null;
  trade_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  match_hint: string;
};

type OcrLineDetected = {
  raw_description: string;
  raw_quantity: number | null;
  raw_unit: string | null;
  raw_unit_price: number | null;
  raw_line_total: number | null;
  validated_unit: ProcurementCanonicalUnit | null;
  warning_notes: string | null;
  user_note: string;
  ingredient_match: {
    ingredient_id: string;
    ingredient_name: string;
    confidence: 'high';
    reason: string;
  } | null;
};

type OcrPage = {
  markdown?: unknown;
  tables?: unknown;
  header?: unknown;
  footer?: unknown;
};

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectUnit(rawValue: string | null): ProcurementCanonicalUnit | null {
  if (!rawValue) return null;
  const normalized = normalizeProcurementText(rawValue);
  if (!normalized) return null;

  if (['kg', 'kilo', 'kilos', 'quilo', 'quilos'].includes(normalized)) return 'kg';
  if (['g', 'gr', 'gramo', 'gramos'].includes(normalized)) return 'g';
  if (['l', 'lt', 'litro', 'litros'].includes(normalized)) return 'l';
  if (['ml', 'mililitro', 'mililitros'].includes(normalized)) return 'ml';
  if (['ud', 'u', 'unidad', 'unidades', 'unit'].includes(normalized)) return 'ud';
  if (['caja', 'cajas', 'box'].includes(normalized)) return 'caja';
  if (['pack', 'paquete'].includes(normalized)) return 'pack';

  const canonical = normalizeProcurementCanonicalUnit(normalized);
  if (typeof canonical !== 'string') return null;
  return canonical;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function markdownTableRows(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));
}

function parseMarkdownTable(markdown: string): Array<Record<string, string>> {
  const rows = markdownTableRows(markdown);
  if (rows.length < 3) return [];

  const headers = rows[0]
    .slice(1, -1)
    .split('|')
    .map((value) => value.trim().toLowerCase());

  return rows
    .slice(2)
    .map((row) => row.slice(1, -1).split('|').map((value) => value.trim()))
    .filter((columns) => columns.some((value) => value.length > 0))
    .map((columns) => {
      const out: Record<string, string> = {};
      headers.forEach((header, index) => {
        out[header || `column_${index + 1}`] = columns[index] ?? '';
      });
      return out;
    });
}

function pickFirstValue(record: Record<string, string>, aliases: string[]): string | null {
  const key = Object.keys(record).find((entry) => aliases.some((alias) => entry.includes(alias)));
  if (!key) return null;
  const value = record[key]?.trim();
  return value?.length ? value : null;
}

function deriveDetectedLines(rawRows: Array<Record<string, string>>, ingredientCandidates: { id: string; name: string }[]): OcrLineDetected[] {
  return rawRows
    .map((row) => {
      const rawDescription =
        pickFirstValue(row, ['descrip', 'producto', 'concept', 'item', 'article', 'artículo']) ??
        pickFirstValue(row, ['column_1']) ??
        '';

      if (!rawDescription.trim()) return null;

      const rawQuantityValue = pickFirstValue(row, ['cantidad', 'qty', 'quant', 'uds', 'unid']);
      const rawUnitValue = pickFirstValue(row, ['unidad', 'unit', 'udm']);
      const rawUnitPriceValue = pickFirstValue(row, ['precio', 'unitario', 'pvp']);
      const rawLineTotalValue = pickFirstValue(row, ['importe', 'total', 'subtotal']);

      const rawQuantity = parseNumber(rawQuantityValue);
      const rawUnitPrice = parseNumber(rawUnitPriceValue);
      const rawLineTotal = parseNumber(rawLineTotalValue);
      const validatedUnit = detectUnit(rawUnitValue);

      const lowerDescription = rawDescription.toLowerCase();
      const exactMatches = ingredientCandidates.filter((ingredient) => lowerDescription.includes(ingredient.name.toLowerCase()));
      const ingredientMatch = exactMatches.length === 1
        ? {
            ingredient_id: exactMatches[0].id,
            ingredient_name: exactMatches[0].name,
            confidence: 'high' as const,
            reason: 'Coincidencia textual exacta en descripción OCR.',
          }
        : null;

      const warnings: string[] = [];
      if (!rawQuantity) warnings.push('Cantidad no detectada con suficiente fiabilidad.');
      if (!rawUnitPrice && !rawLineTotal) warnings.push('No se detectó precio unitario ni total de línea con fiabilidad.');
      if (!validatedUnit && rawUnitValue) warnings.push(`Unidad OCR sin mapear a canónica: "${rawUnitValue}".`);
      if (exactMatches.length > 1) warnings.push('Coincidencia de ingrediente ambigua: varias opciones posibles.');

      return {
        raw_description: rawDescription,
        raw_quantity: rawQuantity,
        raw_unit: rawUnitValue,
        raw_unit_price: rawUnitPrice,
        raw_line_total: rawLineTotal,
        validated_unit: validatedUnit,
        warning_notes: warnings.length ? warnings.join(' ') : null,
        user_note: '',
        ingredient_match: ingredientMatch,
      } satisfies OcrLineDetected;
    })
    .filter((entry): entry is OcrLineDetected => Boolean(entry));
}

function detectSupplierFromText(rawText: string): OcrSupplierDetected {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const nameCandidate = lines.find((line) => line.length > 3 && line.length < 120 && !/[0-9]{3,}/.test(line)) ?? null;
  const taxIdMatch = rawText.match(/\b([A-Z]\d{7}[A-Z0-9]|[A-Z0-9]{1,2}\d{6,10}[A-Z0-9])\b/i);
  const emailMatch = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = rawText.match(/(?:\+34\s?)?(?:\d[\s.-]?){9,12}/);

  return {
    name: nameCandidate,
    trade_name: nameCandidate,
    legal_name: null,
    tax_id: taxIdMatch?.[1] ?? null,
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0]?.trim() ?? null,
    match_hint: 'Sugerencia OCR: confirmar manualmente antes de asignar proveedor.',
  };
}

function detectDeclaredTotal(rawText: string): number | null {
  const totalMatch = rawText.match(/(?:total\s*(?:factura|documento)?|importe\s*total)\s*[:€]?\s*([\d.,]+)/i);
  return parseNumber(totalMatch?.[1] ?? null);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const mistralApiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!mistralApiKey) {
    const response = NextResponse.json({ error: 'Missing server env MISTRAL_API_KEY' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const body = await req.json().catch(() => null);
  const allowOverride = body?.allow_override_lines === true;

  const supabase = createSupabaseAdminClient();
  const [{ data: document, error: documentError }, { count: currentLinesCount, error: linesError }, { data: ingredientCandidates, error: ingredientsError }] = await Promise.all([
    supabase
      .from('cheffing_purchase_documents')
      .select('id, status, storage_bucket, storage_path')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('cheffing_purchase_document_lines')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', params.id),
    supabase.from('cheffing_ingredients').select('id, name').order('name', { ascending: true }),
  ]);

  if (documentError || !document) {
    const response = NextResponse.json({ error: 'Document not found' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (document.status !== 'draft') {
    const response = NextResponse.json({ error: 'OCR only allowed for draft documents' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (!document.storage_bucket || !document.storage_path) {
    const response = NextResponse.json({ error: 'Source file is required before OCR' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (linesError) {
    const response = NextResponse.json({ error: 'Could not inspect current document lines' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if ((currentLinesCount ?? 0) > 0 && !allowOverride) {
    const response = NextResponse.json(
      { error: 'Document already has lines. OCR re-run is blocked to avoid overwriting manual work.' },
      { status: 409 },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const { data: signedData, error: signedError } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60 * 10);
  if (signedError || !signedData?.signedUrl) {
    const response = NextResponse.json({ error: 'Could not create a temporary file URL for OCR' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const mistralResponse = await fetch(MISTRAL_OCR_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mistralApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-ocr-2512',
      document: {
        type: 'document_url',
        document_url: signedData.signedUrl,
      },
      table_format: 'markdown',
      extract_header: true,
      extract_footer: true,
    }),
  });

  const mistralPayload = await mistralResponse.json().catch(() => null);
  if (!mistralResponse.ok) {
    const mistralError = toRecord(mistralPayload);
    const message =
      (typeof mistralError?.message === 'string' && mistralError.message) ||
      (typeof mistralError?.error === 'string' && mistralError.error) ||
      `Mistral OCR failed with status ${mistralResponse.status}`;
    const response = NextResponse.json({ error: message }, { status: 502 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const payloadRecord = toRecord(mistralPayload);
  const pages = Array.isArray(payloadRecord?.pages) ? (payloadRecord.pages as OcrPage[]) : [];

  const rawText = pages
    .map((page) => (typeof page.markdown === 'string' ? page.markdown : null))
    .filter((page): page is string => Boolean(page))
    .join('\n\n');

  const rowsFromMarkdown = pages
    .map((page) => (typeof page.markdown === 'string' ? parseMarkdownTable(page.markdown) : []))
    .flat();

  const rowsFromTables = pages
    .flatMap((page) => (Array.isArray(page.tables) ? page.tables : []))
    .map((table) => {
      const tableRecord = toRecord(table);
      if (!tableRecord) return [] as Array<Record<string, string>>;
      if (typeof tableRecord.markdown === 'string') return parseMarkdownTable(tableRecord.markdown);
      return [] as Array<Record<string, string>>;
    })
    .flat();

  const mergedRows = [...rowsFromTables, ...rowsFromMarkdown];
  const uniqueRowsByDescription = new Map<string, Record<string, string>>();
  for (const row of mergedRows) {
    const description = pickFirstValue(row, ['descrip', 'producto', 'concept', 'item', 'article', 'artículo']) ?? pickFirstValue(row, ['column_1']);
    if (!description) continue;
    if (!uniqueRowsByDescription.has(description.toLowerCase())) {
      uniqueRowsByDescription.set(description.toLowerCase(), row);
    }
  }

  const linesDetected = deriveDetectedLines([...uniqueRowsByDescription.values()], ingredientCandidates ?? []);
  const supplierDetected = detectSupplierFromText(rawText);
  const declaredTotalDetected = detectDeclaredTotal(rawText);

  const interpretedPayload = {
    supplier_detected: supplierDetected,
    lines_detected: linesDetected,
    declared_total_detected: declaredTotalDetected,
    ocr_meta: {
      provider: 'mistral',
      model: 'mistral-ocr-2512',
      table_format: 'markdown',
      extract_header: true,
      extract_footer: true,
      source: 'signed_url',
      page_count: pages.length,
      processed_at: new Date().toISOString(),
      rerun_blocked_if_lines_exist: true,
      note: 'Prepared to support upload/base64 flow in future iterations if signed URL strategy changes.',
    },
  };

  const { error: updateError } = await supabase
    .from('cheffing_purchase_documents')
    .update({
      ocr_raw_text: rawText || null,
      interpreted_payload: interpretedPayload,
    })
    .eq('id', params.id);

  if (updateError) {
    const response = NextResponse.json({ error: updateError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  let insertedLines = 0;
  if ((currentLinesCount ?? 0) === 0 && linesDetected.length > 0) {
    const rows = linesDetected.map((line, index) => ({
      document_id: params.id,
      line_number: index + 1,
      raw_description: line.raw_description,
      raw_quantity: line.raw_quantity,
      raw_unit: line.raw_unit,
      validated_unit: line.validated_unit,
      raw_unit_price: line.raw_unit_price,
      raw_line_total: line.raw_line_total,
      line_status: 'unresolved' as const,
      warning_notes: line.warning_notes,
      user_note: null,
    }));

    const { error: insertError } = await supabase.from('cheffing_purchase_document_lines').insert(rows);
    if (insertError) {
      const response = NextResponse.json({ error: `OCR saved but suggested lines could not be inserted: ${insertError.message}` }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    insertedLines = rows.length;
  }

  if (ingredientsError) {
    console.warn('[procurement OCR] ingredients list not available for suggestion hints', ingredientsError.message);
  }

  const response = NextResponse.json({
    ok: true,
    inserted_lines: insertedLines,
    lines_detected_count: linesDetected.length,
    supplier_detected: supplierDetected,
  });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
