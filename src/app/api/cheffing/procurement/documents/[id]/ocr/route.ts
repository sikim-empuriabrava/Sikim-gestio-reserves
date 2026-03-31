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
  extraction_source: 'items' | 'table' | 'items+table';
  extraction_hints: {
    boxes_from?: 'items' | 'table';
    units_from?: 'items' | 'table';
    product_code_from?: 'items' | 'table';
  } | null;
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
    keyValuePairs?: Array<{
      key?: { content?: string };
      value?: { content?: string };
      confidence?: number;
    }>;
    tables?: Array<{
      rowCount?: number;
      columnCount?: number;
      cells?: Array<{
        rowIndex?: number;
        columnIndex?: number;
        columnSpan?: number;
        rowSpan?: number;
        content?: string;
      }>;
    }>;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type AzureTable = NonNullable<NonNullable<AzureAnalyzeResult['analyzeResult']>['tables']>[number];

function parseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStrictTableInteger(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function parseTaxId(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\b([A-Z]\d{7}[A-Z0-9]|[A-Z0-9]{1,2}\d{6,10}[A-Z0-9])\b/i);
  return match?.[1] ?? null;
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

function hasStrongProductSignal(line: Pick<OcrLineDetected, 'product_code' | 'raw_quantity' | 'raw_unit_price' | 'raw_line_total'>): boolean {
  return Boolean(line.product_code || line.raw_quantity || line.raw_unit_price || line.raw_line_total);
}

function looksLikeNoiseRow(description: string): boolean {
  const normalized = normalizeProcurementText(description);
  if (!normalized || normalized.length < 2) return true;

  const blockedTokens = [
    'ramon bilbao',
    'lolea',
    'mediterranean aperitif',
    'vins i licors grau',
    'recargo',
    'importe total punto verde',
  ];
  if (blockedTokens.some((token) => normalized.includes(token))) return true;

  if (/^(pagina|page|subtotal|total|base imponible|iva|descuento|albaran|factura)\b/i.test(description.trim())) return true;
  if (normalized.includes('www.') || normalized.includes('http')) return true;

  return false;
}

function isUsefulProductLine(line: OcrLineDetected): boolean {
  const hasDescription = line.raw_description.trim().length > 2;
  if (!hasDescription) return false;
  if (looksLikeNoiseRow(line.raw_description)) return false;
  return hasStrongProductSignal(line);
}

function deriveDetectedLinesFromItems(itemFields: AzureFieldValue[] | undefined, ingredientCandidates: { id: string; name: string }[]): OcrLineDetected[] {
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
      const boxes = getFieldNumber(record.Caixes);
      const units = getFieldNumber(record.Ampolles);
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
        boxes,
        units,
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
        extraction_source: 'items',
        extraction_hints: {
          boxes_from: boxes !== null ? 'items' : undefined,
          units_from: units !== null ? 'items' : undefined,
          product_code_from: productCode ? 'items' : undefined,
        },
      } satisfies OcrLineDetected;
    })
    .filter((entry): entry is OcrLineDetected => Boolean(entry))
    .filter(isUsefulProductLine);
}

function tableCellToText(content?: string): string {
  return (content ?? '').trim();
}

function parseTableRows(table: AzureTable): Array<Record<string, string>> {
  if (!table.cells?.length) return [];

  const normalizedCells = table.cells
    .filter((cell) => typeof cell.rowIndex === 'number' && typeof cell.columnIndex === 'number')
    .map((cell) => ({
      rowIndex: cell.rowIndex as number,
      columnIndex: cell.columnIndex as number,
      rowSpan: Math.max(1, cell.rowSpan ?? 1),
      columnSpan: Math.max(1, cell.columnSpan ?? 1),
      content: tableCellToText(cell.content),
    }))
    .sort((a, b) => (a.rowIndex - b.rowIndex) || (a.columnIndex - b.columnIndex));

  if (normalizedCells.length === 0) return [];

  const computedRowCount = table.rowCount ?? Math.max(...normalizedCells.map((cell) => cell.rowIndex + cell.rowSpan));
  const computedColumnCount = table.columnCount ?? Math.max(...normalizedCells.map((cell) => cell.columnIndex + cell.columnSpan));

  const grid: string[][] = Array.from({ length: computedRowCount }, () => Array.from({ length: computedColumnCount }, () => ''));
  for (const cell of normalizedCells) {
    for (let rowOffset = 0; rowOffset < cell.rowSpan; rowOffset += 1) {
      for (let colOffset = 0; colOffset < cell.columnSpan; colOffset += 1) {
        const row = cell.rowIndex + rowOffset;
        const col = cell.columnIndex + colOffset;
        if (row >= computedRowCount || col >= computedColumnCount) continue;
        if (!grid[row][col]) grid[row][col] = cell.content;
      }
    }
  }

  const headerCells = normalizedCells.filter((cell) => cell.rowIndex === 0);

  if (headerCells.length === 0) return [];

  const headers: string[] = Array.from({ length: computedColumnCount }, (_, idx) => `column_${idx + 1}`);

  for (const cell of headerCells) {
    const start = cell.columnIndex;
    const span = cell.columnSpan;
    const normalizedHeader = normalizeProcurementText(cell.content) || `column_${start + 1}`;
    for (let offset = 0; offset < span; offset += 1) {
      headers[start + offset] = normalizedHeader;
    }
  }

  const headerOccurrences = new Map<string, number>();
  const uniqueHeaders = headers.map((header) => {
    const count = (headerOccurrences.get(header) ?? 0) + 1;
    headerOccurrences.set(header, count);
    return count === 1 ? header : `${header}__${count}`;
  });

  const out: Array<Record<string, string>> = [];
  for (let rowIndex = 1; rowIndex < computedRowCount; rowIndex += 1) {
    const row = grid[rowIndex];
    if (!row || row.every((value) => !value.trim())) continue;

    const record: Record<string, string> = {};
    for (let col = 0; col < uniqueHeaders.length; col += 1) {
      record[uniqueHeaders[col] || `column_${col + 1}`] = row[col] ?? '';
    }
    out.push(record);
  }
  return out;
}

function pickValuesByAliases(record: Record<string, string>, aliases: string[]): string[] {
  return Object.keys(record)
    .filter((entry) => aliases.some((alias) => entry.includes(alias)))
    .map((key) => record[key]?.trim() ?? '')
    .filter((value) => value.length > 0);
}

function pickStrictIntegerByAliases(record: Record<string, string>, aliases: string[], min: number, max: number): number | null {
  const values = pickValuesByAliases(record, aliases);
  for (const value of values) {
    const parsed = parseStrictTableInteger(value, min, max);
    if (parsed !== null) return parsed;
  }
  return null;
}

function pickBestDescription(values: string[]): string | null {
  const candidates = values
    .map((value) => value.trim())
    .filter((value) => value.length > 2)
    .filter((value) => !looksLikeNoiseRow(value));
  if (candidates.length === 0) return null;

  return candidates
    .map((value) => ({
      value,
      score: value.length + (/\d/.test(value) ? 2 : 0) - (/^[\d\s.,/-]+$/.test(value) ? 10 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.value ?? null;
}

function pickBestProductCode(values: string[]): string | null {
  const candidates = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => /^[A-Z0-9][A-Z0-9\-/.]{1,24}$/i.test(value))
    .sort((a, b) => a.length - b.length);
  return candidates[0] ?? null;
}

function firstParsedNumber(values: string[]): number | null {
  for (const value of values) {
    const parsed = parseNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function findSupplierValueFromKvPairs(
  pairs: NonNullable<NonNullable<AzureAnalyzeResult['analyzeResult']>['keyValuePairs']> | undefined,
  aliases: string[],
  sanitizer?: (value: string | null) => string | null,
): { value: string | null; source: 'vendor_fields' | 'key_value_pairs' | 'none' } {
  if (!Array.isArray(pairs)) return { value: null, source: 'none' };

  for (const pair of pairs) {
    const keyText = normalizeProcurementText(pair.key?.content ?? '');
    if (!keyText) continue;
    if (!aliases.some((alias) => keyText.includes(alias))) continue;

    const rawValue = pair.value?.content?.trim() ?? null;
    const normalized = sanitizer ? sanitizer(rawValue) : rawValue;
    if (normalized) return { value: normalized, source: 'key_value_pairs' };
  }

  return { value: null, source: 'none' };
}

function isLikelyMainItemsTable(table: AzureTable): boolean {
  const firstRowHeaders = (table.cells ?? [])
    .filter((cell) => cell.rowIndex === 0)
    .map((cell) => normalizeProcurementText(cell.content ?? ''))
    .filter(Boolean);
  if (firstRowHeaders.length === 0) return false;

  const targetHeaders = ['caixes', 'ampolles', 'descripcio', 'referencia', 'preu', 'import'];
  const matches = targetHeaders.filter((target) => firstRowHeaders.some((header) => header.includes(target)));
  return matches.length >= 2;
}

function deriveDetectedLinesFromTables(tables: AzureTable[] | undefined, ingredientCandidates: { id: string; name: string }[]): OcrLineDetected[] {
  if (!Array.isArray(tables)) return [];

  const candidateTables = tables.filter(isLikelyMainItemsTable);
  if (candidateTables.length === 0) return [];

  const rows = candidateTables.flatMap(parseTableRows);

  return rows
    .map((row) => {
      const rawDescriptionCandidates = pickValuesByAliases(row, ['descripcio', 'descrip', 'producto', 'producte', 'item', 'article']);
      const rawDescription = pickBestDescription(rawDescriptionCandidates) ?? '';
      const productCode = pickBestProductCode(pickValuesByAliases(row, ['referencia', 'ref', 'codi', 'codigo', 'code']));
      const rawBoxesValues = pickValuesByAliases(row, ['caixes', 'cajas']);
      const rawUnitsValues = pickValuesByAliases(row, ['ampolles', 'botellas']);
      const boxes = pickStrictIntegerByAliases(row, ['caixes', 'cajas'], 0, 200);
      const units = pickStrictIntegerByAliases(row, ['ampolles', 'botellas'], 0, 1000);
      const quantity = firstParsedNumber(pickValuesByAliases(row, ['quantitat', 'cantidad', 'qty'])) ?? boxes ?? units;
      const rawUnitPrice = firstParsedNumber(pickValuesByAliases(row, ['preu', 'precio', 'unitari', 'unitario']));
      const rawLineTotal = firstParsedNumber(pickValuesByAliases(row, ['import', 'importe', 'total']));

      const line: OcrLineDetected = {
        raw_description: rawDescription,
        boxes,
        units,
        raw_quantity: quantity,
        raw_unit: null,
        raw_unit_price: rawUnitPrice,
        raw_line_total: rawLineTotal,
        product_code: productCode,
        validated_unit: null,
        warning_notes: null,
        user_note: '',
        ingredient_match: null,
        source_confidence: null,
        extraction_source: 'table',
        extraction_hints: {
          boxes_from: boxes !== null ? 'table' : undefined,
          units_from: units !== null ? 'table' : undefined,
          product_code_from: productCode ? 'table' : undefined,
        },
      };
      const suspiciousSignals: string[] = [];
      if (rawBoxesValues.some((value) => parseStrictTableInteger(value, 0, 200) === null)) {
        suspiciousSignals.push(`Valor(es) Caixes descartado(s) por formato/rango: "${rawBoxesValues.join(' | ')}".`);
      }
      if (rawUnitsValues.some((value) => parseStrictTableInteger(value, 0, 1000) === null)) {
        suspiciousSignals.push(`Valor(es) Ampolles descartado(s) por formato/rango: "${rawUnitsValues.join(' | ')}".`);
      }
      if (suspiciousSignals.length > 0) line.warning_notes = suspiciousSignals.join(' ');

      const lowerDescription = rawDescription.toLowerCase();
      const exactMatches = ingredientCandidates.filter((ingredient) => lowerDescription.includes(ingredient.name.toLowerCase()));
      if (exactMatches.length === 1) {
        line.ingredient_match = {
          ingredient_id: exactMatches[0].id,
          ingredient_name: exactMatches[0].name,
          confidence: 'high',
          reason: 'Coincidencia textual exacta en descripción OCR.',
        };
      }
      if (exactMatches.length > 1) {
        line.warning_notes = [line.warning_notes, 'Coincidencia de ingrediente ambigua: varias opciones posibles.'].filter(Boolean).join(' ');
      }

      return line;
    })
    .filter(isUsefulProductLine);
}

function matchKeysFromLine(line: Pick<OcrLineDetected, 'raw_description' | 'product_code'>): string[] {
  const keys: string[] = [];
  if (line.product_code) {
    const normalizedCode = normalizeProcurementText(line.product_code);
    if (normalizedCode) keys.push(`code:${normalizedCode}`);
  }
  const normalizedDescription = normalizeProcurementText(line.raw_description);
  if (normalizedDescription) keys.push(`desc:${normalizedDescription.slice(0, 48)}`);
  return keys;
}

function enrichItemsWithTableQuantities(items: OcrLineDetected[], tableLines: OcrLineDetected[]): OcrLineDetected[] {
  if (items.length === 0 || tableLines.length === 0) return items;

  const tableByKey = new Map<string, OcrLineDetected>();
  for (const line of tableLines) {
    const keys = matchKeysFromLine(line);
    for (const key of keys) {
      if (tableByKey.has(key)) continue;
      tableByKey.set(key, line);
    }
  }

  return items.map((item) => {
    const lookupKeys = matchKeysFromLine(item);
    if (lookupKeys.length === 0) return item;
    const tableMatch = lookupKeys.map((key) => tableByKey.get(key)).find((entry): entry is OcrLineDetected => Boolean(entry));
    if (!tableMatch) return item;

    const mergedWarnings = [item.warning_notes, tableMatch.warning_notes].filter(Boolean).join(' ') || null;
    const didFillBoxes = item.boxes === null && tableMatch.boxes !== null;
    const didFillUnits = item.units === null && tableMatch.units !== null;
    const didFillProductCode = !item.product_code && Boolean(tableMatch.product_code);
    return {
      ...item,
      boxes: item.boxes ?? tableMatch.boxes,
      units: item.units ?? tableMatch.units,
      product_code: item.product_code ?? tableMatch.product_code,
      warning_notes: mergedWarnings,
      extraction_source: didFillBoxes || didFillUnits || didFillProductCode ? 'items+table' : item.extraction_source,
      extraction_hints: {
        boxes_from: item.boxes !== null ? 'items' : tableMatch.boxes !== null ? 'table' : item.extraction_hints?.boxes_from,
        units_from: item.units !== null ? 'items' : tableMatch.units !== null ? 'table' : item.extraction_hints?.units_from,
        product_code_from: item.product_code ? 'items' : tableMatch.product_code ? 'table' : item.extraction_hints?.product_code_from,
      },
    };
  });
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
  const analyzeUrl = `${azureBase}/documentintelligence/documentModels/${AZURE_MODEL_ID}:analyze?api-version=${AZURE_API_VERSION}&features=keyValuePairs`;
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
  const keyValuePairs = analyzePayload.analyzeResult.keyValuePairs;
  const rawText = analyzePayload.analyzeResult.content ?? '';

  const kvEmail = findSupplierValueFromKvPairs(keyValuePairs, ['email', 'e-mail', 'mail', 'correu']);
  const kvPhone = findSupplierValueFromKvPairs(keyValuePairs, ['tel', 'telefono', 'phone', 'tlf']);
  const kvTaxId = findSupplierValueFromKvPairs(keyValuePairs, ['cif', 'nif', 'vat', 'tax id'], parseTaxId);

  const vendorEmail = getFieldString(fields.VendorEmail);
  const vendorPhone = getFieldString(fields.VendorPhoneNumber);
  const vendorTaxIdRaw = getFieldString(fields.VendorTaxId);
  const vendorTaxId = vendorTaxIdRaw ? parseTaxId(vendorTaxIdRaw) ?? vendorTaxIdRaw : null;

  const supplierTrace = {
    email_source: (vendorEmail ? 'vendor_fields' : kvEmail.source) as 'vendor_fields' | 'key_value_pairs' | 'none',
    phone_source: (vendorPhone ? 'vendor_fields' : kvPhone.source) as 'vendor_fields' | 'key_value_pairs' | 'none',
    tax_id_source: (vendorTaxId ? 'vendor_fields' : kvTaxId.source) as 'vendor_fields' | 'key_value_pairs' | 'none',
  };

  const supplierDetected = {
    name: getFieldString(fields.VendorName),
    trade_name: getFieldString(fields.VendorName),
    legal_name: getFieldString(fields.VendorName),
    tax_id: vendorTaxId ?? kvTaxId.value,
    email: vendorEmail ?? kvEmail.value,
    phone: vendorPhone ?? kvPhone.value,
    match_hint:
      'Sugerencia OCR: confirmar manualmente antes de asignar proveedor. ' +
      `Fuentes proveedor -> email:${supplierTrace.email_source}, phone:${supplierTrace.phone_source}, tax_id:${supplierTrace.tax_id_source}.`,
  } satisfies OcrSupplierDetected;

  const linesFromItems = deriveDetectedLinesFromItems(fields.Items?.valueArray, ingredientCandidates ?? []);
  const linesFromTables = deriveDetectedLinesFromTables(analyzePayload.analyzeResult.tables, ingredientCandidates ?? []);
  const linesDetected =
    linesFromItems.length === 0 ? linesFromTables : enrichItemsWithTableQuantities(linesFromItems, linesFromTables);

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
      supplier_trace: supplierTrace,
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
