import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { normalizeProcurementCanonicalUnit, normalizeProcurementText, type ProcurementCanonicalUnit } from '@/lib/cheffing/procurement';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AZURE_API_VERSION = '2024-11-30';
const AZURE_MODEL_ID = 'prebuilt-invoice';
const AZURE_POLL_INTERVAL_MS = 1500;
const AZURE_POLL_TIMEOUT_MS = 90_000;

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
  boxes: number | null;
  units: number | null;
  raw_quantity: number | null;
  raw_unit: string | null;
  raw_unit_price: number | null;
  raw_line_total: number | null;
  product_code: string | null;
  validated_unit: ProcurementCanonicalUnit | null;
  warning_notes: string | null;
  user_note: string;
  ingredient_match: {
    ingredient_id: string;
    ingredient_name: string;
    confidence: 'high';
    reason: string;
  } | null;
  source_confidence: number | null;
};

type AzureFieldValue = {
  type?: string;
  valueString?: string;
  valueNumber?: number;
  valueDate?: string;
  valueCurrency?: { amount?: number; currencySymbol?: string; currencyCode?: string };
  valuePhoneNumber?: string;
  valueArray?: AzureFieldValue[];
  valueObject?: Record<string, AzureFieldValue>;
  content?: string;
  confidence?: number;
};

type AzureAnalyzedDocument = {
  docType?: string;
  fields?: Record<string, AzureFieldValue>;
  confidence?: number;
};

type AzureAnalyzeResult = {
  status?: string;
  analyzeResult?: {
    content?: string;
    documents?: AzureAnalyzedDocument[];
  };
  error?: {
    code?: string;
    message?: string;
  };
};

function parseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
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

function getFieldString(field?: AzureFieldValue): string | null {
  if (!field) return null;
  const value = field.valueString ?? field.valuePhoneNumber ?? field.content;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getFieldNumber(field?: AzureFieldValue): number | null {
  if (!field) return null;
  if (typeof field.valueNumber === 'number') return parseNumber(field.valueNumber);
  if (typeof field.valueCurrency?.amount === 'number') return parseNumber(field.valueCurrency.amount);
  return parseNumber(field.content ?? null);
}

function getFieldDate(field?: AzureFieldValue): string | null {
  if (!field) return null;
  if (typeof field.valueDate === 'string') return field.valueDate;
  return getFieldString(field);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveDetectedLines(itemFields: AzureFieldValue[] | undefined, ingredientCandidates: { id: string; name: string }[]): OcrLineDetected[] {
  if (!Array.isArray(itemFields)) return [];

  return itemFields
    .map((item) => {
      const record = item.valueObject;
      if (!record) return null;

      const rawDescription =
        getFieldString(record.Description) ?? getFieldString(record.ProductCode) ?? getFieldString(record.ItemCode) ?? '';
      if (!rawDescription.trim()) return null;

      const rawQuantity = getFieldNumber(record.Quantity);
      const rawUnit = getFieldString(record.Unit);
      const rawUnitPrice = getFieldNumber(record.UnitPrice);
      const rawLineTotal = getFieldNumber(record.Amount);
      const productCode = getFieldString(record.ProductCode) ?? getFieldString(record.ItemCode);
      const validatedUnit = detectUnit(rawUnit);
      const sourceConfidence = typeof item.confidence === 'number' ? item.confidence : null;

      const lowerDescription = rawDescription.toLowerCase();
      const exactMatches = ingredientCandidates.filter((ingredient) => lowerDescription.includes(ingredient.name.toLowerCase()));
      const ingredientMatch =
        exactMatches.length === 1
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
      if (!validatedUnit && rawUnit) warnings.push(`Unidad OCR sin mapear a canónica: "${rawUnit}".`);
      if (exactMatches.length > 1) warnings.push('Coincidencia de ingrediente ambigua: varias opciones posibles.');

      return {
        raw_description: rawDescription,
        boxes: null,
        units: null,
        raw_quantity: rawQuantity,
        raw_unit: rawUnit,
        raw_unit_price: rawUnitPrice,
        raw_line_total: rawLineTotal,
        product_code: productCode,
        validated_unit: validatedUnit,
        warning_notes: warnings.length ? warnings.join(' ') : null,
        user_note: '',
        ingredient_match: ingredientMatch,
        source_confidence: sourceConfidence,
      } satisfies OcrLineDetected;
    })
    .filter((entry): entry is OcrLineDetected => Boolean(entry));
}

function mapDocumentKind(docType?: string): 'invoice' | 'delivery_note' | 'other' {
  if (!docType) return 'other';
  const normalized = docType.toLowerCase();
  if (normalized.includes('invoice')) return 'invoice';
  if (normalized.includes('delivery') || normalized.includes('albaran')) return 'delivery_note';
  return 'other';
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const azureEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim();
  if (!azureEndpoint || !azureKey) {
    const response = NextResponse.json(
      { error: 'Missing server env AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or AZURE_DOCUMENT_INTELLIGENCE_KEY' },
      { status: 500 },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const body = await req.json().catch(() => null);
  const allowOverride = body?.allow_override_lines === true;

  const supabase = createSupabaseAdminClient();
  const [{ data: document, error: documentError }, { count: currentLinesCount, error: linesError }, { data: ingredientCandidates, error: ingredientsError }] =
    await Promise.all([
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

  const azureBase = azureEndpoint.replace(/\/+$/, '');
  const analyzeUrl = `${azureBase}/documentintelligence/documentModels/${AZURE_MODEL_ID}:analyze?api-version=${AZURE_API_VERSION}`;
  const azureStartResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': azureKey,
    },
    body: JSON.stringify({
      urlSource: signedData.signedUrl,
    }),
  });

  const azureStartPayload = await azureStartResponse.json().catch(() => null);
  if (!azureStartResponse.ok) {
    const azureError = toRecord(azureStartPayload);
    const message =
      (typeof azureError?.message === 'string' && azureError.message) ||
      (typeof toRecord(azureError?.error)?.message === 'string' && (toRecord(azureError?.error)?.message as string)) ||
      `Azure Document Intelligence analyze start failed with status ${azureStartResponse.status}`;
    const response = NextResponse.json({ error: message }, { status: 502 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const operationLocation = azureStartResponse.headers.get('Operation-Location');
  if (!operationLocation) {
    const response = NextResponse.json({ error: 'Azure response missing Operation-Location header' }, { status: 502 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const pollStartedAt = Date.now();
  let analyzePayload: AzureAnalyzeResult | null = null;

  while (Date.now() - pollStartedAt < AZURE_POLL_TIMEOUT_MS) {
    await sleep(AZURE_POLL_INTERVAL_MS);
    const pollResponse = await fetch(operationLocation, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
      },
    });

    const payload = (await pollResponse.json().catch(() => null)) as AzureAnalyzeResult | null;
    if (!pollResponse.ok) {
      const azureError = toRecord(payload);
      const message =
        (typeof azureError?.message === 'string' && azureError.message) ||
        (typeof toRecord(azureError?.error)?.message === 'string' && (toRecord(azureError?.error)?.message as string)) ||
        `Azure Document Intelligence polling failed with status ${pollResponse.status}`;
      const response = NextResponse.json({ error: message }, { status: 502 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }

    const status = payload?.status?.toLowerCase();
    if (status === 'succeeded') {
      analyzePayload = payload;
      break;
    }

    if (status === 'failed') {
      const failureMessage = payload?.error?.message || 'Azure Document Intelligence analysis failed';
      const response = NextResponse.json({ error: failureMessage }, { status: 502 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
  }

  if (!analyzePayload?.analyzeResult) {
    const response = NextResponse.json({ error: 'Azure Document Intelligence timeout while waiting for OCR result' }, { status: 504 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const firstDocument = analyzePayload.analyzeResult.documents?.[0];
  const fields = firstDocument?.fields ?? {};
  const rawText = analyzePayload.analyzeResult.content ?? '';

  const supplierDetected = {
    name: getFieldString(fields.VendorName) ?? getFieldString(fields.CustomerName),
    trade_name: getFieldString(fields.VendorName),
    legal_name: getFieldString(fields.VendorName),
    tax_id: getFieldString(fields.VendorTaxId) ?? getFieldString(fields.CustomerTaxId),
    email: getFieldString(fields.VendorEmail) ?? getFieldString(fields.CustomerEmail),
    phone: getFieldString(fields.VendorPhoneNumber) ?? getFieldString(fields.CustomerPhoneNumber),
    match_hint: 'Sugerencia OCR: confirmar manualmente antes de asignar proveedor.',
  } satisfies OcrSupplierDetected;

  const linesDetected = deriveDetectedLines(fields.Items?.valueArray, ingredientCandidates ?? []);

  const interpretedPayload = {
    supplier_detected: supplierDetected,
    document_detected: {
      document_kind: mapDocumentKind(firstDocument?.docType),
      document_number: getFieldString(fields.InvoiceId),
      document_date: getFieldDate(fields.InvoiceDate),
      due_date: getFieldDate(fields.DueDate),
      declared_total: getFieldNumber(fields.InvoiceTotal) ?? getFieldNumber(fields.AmountDue),
    },
    lines_detected: linesDetected,
    ocr_meta: {
      provider: 'azure_document_intelligence',
      model: AZURE_MODEL_ID,
      api_version: AZURE_API_VERSION,
      source: 'signed_url',
      processed_at: new Date().toISOString(),
      rerun_blocked_if_lines_exist: true as const,
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
