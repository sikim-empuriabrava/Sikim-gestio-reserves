import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { normalizeProcurementCanonicalUnit, normalizeProcurementText, type ProcurementCanonicalUnit } from '@/lib/cheffing/procurement';
import { runOpenAiOcrCleanup, shouldRunOpenAiOcrCleanup } from '@/lib/cheffing/procurement/openaiOcrCleanup';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AZURE_API_VERSION = '2024-11-30';
const AZURE_MODEL_ID = 'prebuilt-invoice';
const DEFAULT_AZURE_POLL_INTERVAL_MS = 1500;
const DEFAULT_AZURE_POLL_TIMEOUT_MS = 90_000;

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

type OcrPossibleDuplicate = {
  line_number: number;
  duplicate_of_line_number: number;
  confidence: 'high' | 'medium';
  reason: string;
};

type OcrCleanupMeta = {
  provider: 'openai';
  status: 'applied' | 'skipped' | 'failed';
  model: string | null;
  processed_at: string;
  affected_lines: number;
  warning: string | null;
};

type SupplierCandidateRow = {
  id: string;
  trade_name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
};

type SupplierCandidateHint = {
  id: string;
  trade_name: string;
  tax_id: string | null;
  score_hint: number;
  match_reasons: string[];
};

type SupplierExistingSuggestion = {
  supplier_id: string;
  trade_name: string;
  score_hint: number;
  match_reasons: string[];
  is_strong_match: boolean;
  is_dominant: boolean;
  dominance_gap: number | null;
  should_auto_select: boolean;
};

type SupplierEnrichmentResult = {
  supplier_id: string;
  auto_filled: Array<{ field: 'tax_id' | 'email' | 'phone'; value: string; source: 'ocr' | 'openai_cleanup' }>;
  conflicts: Array<{ field: 'tax_id' | 'email' | 'phone'; existing_value: string; detected_value: string; reason: string }>;
  update_attempt: {
    attempted: boolean;
    applied: boolean;
    warning: string | null;
  };
};

type IngredientCandidateRow = { id: string; name: string; reference: string | null };
type SupplierProductRefRow = {
  supplier_id: string;
  ingredient_id: string;
  supplier_product_description: string;
  supplier_product_alias: string | null;
  reference_unit_code: string | null;
  reference_format_qty: number | null;
};

type LineCandidateHint = {
  ingredient_id: string;
  ingredient_name: string;
  supplier_ref_context: {
    supplier_id: string;
    supplier_product_description: string;
    supplier_product_alias: string | null;
    reference_unit_code: string | null;
    reference_format_qty: number | null;
  } | null;
  score_hint: number;
  match_reasons: string[];
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

function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) {
    const compact = `+${digits.slice(1).replace(/\D/g, '')}`;
    return compact.length > 4 ? compact : null;
  }
  const compact = digits.replace(/\D/g, '');
  return compact.length >= 7 ? compact : null;
}

function normalizeSupplierNameForMatch(value: string | null): string | null {
  const normalized = normalizeProcurementText(value);
  if (!normalized) return null;
  return normalized
    .replace(/[.,]/g, ' ')
    .replace(/\b(sociedad\s+limitada|sociedad\s+anonima)\b/g, ' ')
    .replace(/\b(s\.?\s*l\.?\s*u?|s\.?\s*a\.?\s*u?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesNormalizedText(haystack: string | null, needle: string | null): boolean {
  const normalizedHaystack = normalizeProcurementText(haystack);
  const normalizedNeedle = normalizeProcurementText(needle);
  if (!normalizedHaystack || !normalizedNeedle) return false;
  return normalizedHaystack.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedHaystack);
}

function hasCompatibleUnit(rawUnit: string | null, referenceUnitCode: string | null): boolean {
  const normalizedRaw = normalizeProcurementCanonicalUnit(rawUnit);
  const normalizedRef = normalizeProcurementCanonicalUnit(referenceUnitCode);
  return typeof normalizedRaw === 'string' && typeof normalizedRef === 'string' && normalizedRaw === normalizedRef;
}

function isCompatibleFormatQuantity(
  rawQuantity: number | null,
  boxes: number | null,
  units: number | null,
  referenceFormatQty: number | null,
): boolean {
  if (referenceFormatQty === null || referenceFormatQty <= 0) return false;
  const signals = [rawQuantity, boxes, units].filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return signals.some((value) => Math.abs(value - referenceFormatQty) <= 0.001);
}

function buildSupplierCandidates(input: {
  supplierDetectedRaw: OcrSupplierDetected;
  suppliers: SupplierCandidateRow[];
}): SupplierCandidateHint[] {
  const taxId = parseTaxId(input.supplierDetectedRaw.tax_id);
  const email = input.supplierDetectedRaw.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.supplierDetectedRaw.phone);
  const detectedNames = Array.from(
    new Set(
      [
    input.supplierDetectedRaw.trade_name,
    input.supplierDetectedRaw.name,
    input.supplierDetectedRaw.legal_name,
      ]
        .map((entry) => normalizeSupplierNameForMatch(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );

  return input.suppliers
    .map((supplier) => {
      const reasons: string[] = [];
      let score = 0;
      const supplierTaxId = parseTaxId(supplier.tax_id);
      const supplierTradeName = normalizeSupplierNameForMatch(supplier.trade_name);
      const supplierEmail = supplier.email?.trim().toLowerCase() || null;
      const supplierPhone = normalizePhone(supplier.phone);

      if (taxId && supplierTaxId && taxId === supplierTaxId) {
        score += 80;
        reasons.push('tax_id_exact');
      }
      if (email && supplierEmail && email === supplierEmail) {
        score += 65;
        reasons.push('email_exact');
      }
      if (phone && supplierPhone && phone === supplierPhone) {
        score += 55;
        reasons.push('phone_exact_normalized');
      }

      for (const detectedName of detectedNames) {
        if (!detectedName || !supplierTradeName) continue;
        if (detectedName === supplierTradeName) {
          score += 60;
          reasons.push('trade_name_exact_normalized');
          continue;
        }
        if (detectedName.includes(supplierTradeName) || supplierTradeName.includes(detectedName)) {
          score += 32;
          reasons.push('trade_name_substring');
        }
      }

      return {
        id: supplier.id,
        trade_name: supplier.trade_name,
        tax_id: supplier.tax_id,
        score_hint: score,
        match_reasons: Array.from(new Set(reasons)),
      } satisfies SupplierCandidateHint;
    })
    .filter((candidate) => candidate.score_hint > 0)
    .sort((a, b) => b.score_hint - a.score_hint)
    .slice(0, 5);
}

function getSuggestedExistingSupplier(candidates: SupplierCandidateHint[]): SupplierExistingSuggestion | null {
  const top = candidates[0];
  if (!top) return null;
  const second = candidates[1];
  const dominanceGap = typeof second?.score_hint === 'number' ? top.score_hint - second.score_hint : null;
  const hasIdentitySignal = top.match_reasons.some((reason) =>
    reason === 'tax_id_exact' || reason === 'email_exact' || reason === 'phone_exact_normalized',
  );
  const hasExactNameSignal = top.match_reasons.some((reason) => reason === 'trade_name_exact_normalized');
  const hasNameSignal = top.match_reasons.some((reason) =>
    reason === 'trade_name_exact_normalized' || reason === 'trade_name_substring',
  );
  const isStrongMatch = hasIdentitySignal ? top.score_hint >= 85 : hasExactNameSignal && top.score_hint >= 60;
  const isDominant = dominanceGap === null || dominanceGap >= 18;
  return {
    supplier_id: top.id,
    trade_name: top.trade_name,
    score_hint: top.score_hint,
    match_reasons: top.match_reasons,
    is_strong_match: isStrongMatch,
    is_dominant: isDominant,
    dominance_gap: dominanceGap,
    should_auto_select:
      isStrongMatch &&
      isDominant &&
      (hasIdentitySignal || (hasExactNameSignal && (dominanceGap === null || dominanceGap >= 35)) || (hasNameSignal && top.score_hint >= 95)),
  };
}

function isSupplierFieldConfident(params: {
  field: 'tax_id' | 'email' | 'phone';
  trace: { email_source: 'vendor_fields' | 'key_value_pairs' | 'none'; phone_source: 'vendor_fields' | 'key_value_pairs' | 'none'; tax_id_source: 'vendor_fields' | 'key_value_pairs' | 'none' };
  hasReliableSupplierCleanup: boolean;
}): boolean {
  if (params.hasReliableSupplierCleanup) return true;
  if (params.field === 'email') return params.trace.email_source === 'vendor_fields';
  if (params.field === 'phone') return params.trace.phone_source === 'vendor_fields';
  return params.trace.tax_id_source === 'vendor_fields';
}

function normalizedComparableValue(field: 'tax_id' | 'email' | 'phone', value: string | null): string | null {
  if (!value) return null;
  if (field === 'tax_id') return normalizeProcurementText(value.replace(/[^a-zA-Z0-9]/g, ''));
  if (field === 'email') return normalizeProcurementText(value.trim().toLowerCase());
  return normalizePhone(value);
}

function buildLineCandidates(input: {
  lineNumber: number;
  line: OcrLineDetected;
  ingredients: IngredientCandidateRow[];
  supplierProductRefs: SupplierProductRefRow[];
  supplierCandidates: SupplierCandidateHint[];
}): { line_number: number; candidates: LineCandidateHint[] } {
  const normalizedDescription = normalizeProcurementText(input.line.raw_description);
  const normalizedProductCode = normalizeProcurementText(input.line.product_code);
  const topSupplierIds = new Set(input.supplierCandidates.map((candidate) => candidate.id));

  const candidates = input.ingredients
    .map((ingredient) => {
      const reasons: string[] = [];
      let score = 0;
      const ingredientName = normalizeProcurementText(ingredient.name);
      const ingredientReference = normalizeProcurementText(ingredient.reference);
      const refs = input.supplierProductRefs.filter((ref) => ref.ingredient_id === ingredient.id);
      let bestRefContext: LineCandidateHint['supplier_ref_context'] = null;
      let bestRefScore = 0;

      if (normalizedDescription && ingredientName && includesNormalizedText(normalizedDescription, ingredientName)) {
        score += 45;
        reasons.push('ingredient_name_text_match');
      }
      if (normalizedProductCode && ingredientReference && normalizedProductCode === ingredientReference) {
        score += 55;
        reasons.push('ingredient_reference_exact');
      }

      for (const ref of refs) {
        let refScore = 0;
        const refReasons: string[] = [];
        const refDescription = normalizeProcurementText(ref.supplier_product_description);
        const refAlias = normalizeProcurementText(ref.supplier_product_alias);
        const refMatchesText =
          (normalizedDescription && refDescription && includesNormalizedText(normalizedDescription, refDescription)) ||
          (normalizedDescription && refAlias && includesNormalizedText(normalizedDescription, refAlias));
        if (refMatchesText) {
          refScore += 38;
          refReasons.push('supplier_ref_description_match');
        }
        if (topSupplierIds.has(ref.supplier_id)) {
          refScore += 22;
          refReasons.push('supplier_candidate_bonus');
        }
        if (hasCompatibleUnit(input.line.raw_unit, ref.reference_unit_code)) {
          refScore += 10;
          refReasons.push('compatible_unit_bonus');
        }
        if (isCompatibleFormatQuantity(input.line.raw_quantity, input.line.boxes, input.line.units, ref.reference_format_qty)) {
          refScore += 8;
          refReasons.push('compatible_format_qty_bonus');
        }

        score += refScore;
        reasons.push(...refReasons);

        if (refScore > bestRefScore) {
          bestRefScore = refScore;
          bestRefContext = {
            supplier_id: ref.supplier_id,
            supplier_product_description: ref.supplier_product_description,
            supplier_product_alias: ref.supplier_product_alias,
            reference_unit_code: ref.reference_unit_code,
            reference_format_qty: ref.reference_format_qty,
          };
        }
      }

      return {
        ingredient_id: ingredient.id,
        ingredient_name: ingredient.name,
        supplier_ref_context: bestRefContext,
        score_hint: score,
        match_reasons: Array.from(new Set(reasons)),
      } satisfies LineCandidateHint;
    })
    .filter((candidate) => candidate.score_hint > 0)
    .sort((a, b) => b.score_hint - a.score_hint)
    .slice(0, 8);

  return {
    line_number: input.lineNumber,
    candidates,
  };
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

function parsePositiveIntEnv(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

function looksLikeNoiseRow(description: string): boolean {
  const normalized = normalizeProcurementText(description);
  if (!normalized || normalized.length < 2) return true;

  if (/^(pagina|page|subtotal|total|base imponible|iva|descuento|albaran|factura|observaciones|notes?)\b/i.test(description.trim())) return true;
  if (/^(banco|iban|swift|bic|vencimiento|forma de pago|metodo de pago)\b/i.test(normalized)) return true;
  if (normalized.includes('registro mercantil') || normalized.includes('punto verde')) return true;
  if (normalized.includes('www.') || normalized.includes('http')) return true;

  return false;
}

function isUsefulProductLine(line: OcrLineDetected): boolean {
  const hasDescription = line.raw_description.trim().length > 1;
  if (!hasDescription) return false;
  if (looksLikeNoiseRow(line.raw_description)) return false;
  return true;
}

function deriveDetectedLinesFromItems(itemFields: AzureFieldValue[] | undefined, ingredientCandidates: { id: string; name: string }[]): OcrLineDetected[] {
  if (!Array.isArray(itemFields)) return [];

  const parsedLines: OcrLineDetected[] = itemFields.flatMap((item) => {
      const record = item.valueObject;
      if (!record) return [];

      const rawDescription =
        getFieldString(record.Description) ?? getFieldString(record.ProductCode) ?? getFieldString(record.ItemCode) ?? '';
      if (!rawDescription.trim()) return [];

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

      const line = {
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
      return [line];
    });

  return parsedLines.filter(isUsefulProductLine);
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
  const supplierContextTokens = ['proveedor', 'vendor', 'supplier', 'emisor', 'seller', 'expedidor'];
  const ambiguousContextTokens = ['cliente', 'customer', 'buyer', 'comprador', 'billing', 'bill to', 'ship to', 'delivery', 'destinatario'];

  for (const pair of pairs) {
    const keyText = normalizeProcurementText(pair.key?.content ?? '');
    if (!keyText) continue;
    if (!supplierContextTokens.some((token) => keyText.includes(token))) continue;
    if (ambiguousContextTokens.some((token) => keyText.includes(token))) continue;
    if (!aliases.some((alias) => keyText.includes(alias))) continue;

    const rawValue = pair.value?.content?.trim() ?? null;
    const normalized = sanitizer ? sanitizer(rawValue) : rawValue;
    if (normalized) return { value: normalized, source: 'key_value_pairs' };
  }

  return { value: null, source: 'none' };
}

function extractDocumentNumberFallback(params: {
  invoiceFieldValue: string | null;
  kvPairs: NonNullable<NonNullable<AzureAnalyzeResult['analyzeResult']>['keyValuePairs']> | undefined;
  rawText: string;
}): { value: string | null; source: 'invoice_field' | 'key_value_pairs' | 'raw_text' | 'none' } {
  const looksLikeDateToken = (value: string): boolean =>
    /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})$/.test(value);
  const looksLikeFiscalId = (value: string): boolean =>
    /^[A-HJNPQRSUVW]\d{7}[0-9A-J]$/i.test(value) || /^\d{8}[A-Z]$/i.test(value) || /^ES[A-Z0-9]{9,12}$/i.test(value);
  const looksLikeAmountToken = (value: string): boolean =>
    /€|eur/i.test(value) || /^\d{1,3}(?:[.,]\d{3})*[.,]\d{2}$/.test(value) || /^\d+[.,]\d{2}$/.test(value);

  const cleanCandidate = (value: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const compact = trimmed.replace(/\s+/g, '');
    if (!/[0-9]/.test(compact)) return null;
    if (!/^[A-Z0-9][A-Z0-9\-/.]{2,24}$/i.test(compact)) return null;
    if (looksLikeDateToken(compact)) return null;
    if (looksLikeFiscalId(compact)) return null;
    if (looksLikeAmountToken(trimmed) || looksLikeAmountToken(compact)) return null;
    return compact;
  };

  const invoiceField = cleanCandidate(params.invoiceFieldValue);
  if (invoiceField) return { value: invoiceField, source: 'invoice_field' };

  const numberLikeKey = /(num(\.|ero)?\s*(alb|albar[aà]n|albara|fact|fra)?|sf\s*\/\s*num\.?\s*alb\.?|albar[aà]|n[uú]mero)/i;
  if (Array.isArray(params.kvPairs)) {
    for (const pair of params.kvPairs) {
      const key = pair.key?.content ?? '';
      if (!numberLikeKey.test(key)) continue;
      const kvCandidate = cleanCandidate(pair.value?.content ?? null);
      if (kvCandidate) return { value: kvCandidate, source: 'key_value_pairs' };
    }
  }

  const rawTextPatterns = [
    /(?:sf\s*\/\s*num\.?\s*alb\.?|num\.?\s*alb(?:ar[aà]n)?|n[uú]mero|albar[aà])\s*[:#-]?\s*([a-z0-9][a-z0-9\-/.]{2,24})/i,
  ];
  for (const pattern of rawTextPatterns) {
    const match = params.rawText.match(pattern);
    const rawCandidate = cleanCandidate(match?.[1] ?? null);
    if (rawCandidate) return { value: rawCandidate, source: 'raw_text' };
  }

  return { value: null, source: 'none' };
}

function isLikelyMainItemsTable(table: AzureTable): boolean {
  const firstRowHeaders = (table.cells ?? [])
    .filter((cell) => cell.rowIndex === 0)
    .map((cell) => normalizeProcurementText(cell.content ?? ''))
    .filter((header): header is string => typeof header === 'string' && header.length > 0);
  if (firstRowHeaders.length === 0) return false;

  const groups = [
    ['descripcio', 'descripcion', 'desc', 'item', 'article', 'product'],
    ['quantitat', 'cantidad', 'qty', 'quantity'],
    ['preu', 'precio', 'unitari', 'unitario', 'unit price'],
    ['import', 'importe', 'total', 'amount'],
    ['referencia', 'codigo', 'codi', 'code', 'sku', 'ref'],
    ['caixes', 'cajas', 'boxes'],
    ['ampolles', 'botellas', 'units'],
  ];
  const matchedGroups = groups.filter((group) => group.some((target) => firstRowHeaders.some((header) => header.includes(target))));
  return matchedGroups.length >= 2;
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
  if (items.length === 0) return tableLines;
  if (tableLines.length === 0) return items;

  const tableByKey = new Map<string, { index: number; line: OcrLineDetected }>();
  for (const [index, line] of tableLines.entries()) {
    const keys = matchKeysFromLine(line);
    for (const key of keys) {
      if (tableByKey.has(key)) continue;
      tableByKey.set(key, { index, line });
    }
  }

  const matchedTableIndexes = new Set<number>();
  const mergedItems = items.map((item) => {
    const lookupKeys = matchKeysFromLine(item);
    if (lookupKeys.length === 0) return item;
    const tableMatchEntry = lookupKeys
      .map((key) => tableByKey.get(key))
      .find((entry): entry is { index: number; line: OcrLineDetected } => Boolean(entry));
    if (!tableMatchEntry) return item;
    matchedTableIndexes.add(tableMatchEntry.index);
    const tableMatch = tableMatchEntry.line;

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

  const unmatchedTableLines = tableLines.filter((_, index) => !matchedTableIndexes.has(index));
  return [...mergedItems, ...unmatchedTableLines];
}

function mapDocumentKind(docType?: string): 'invoice' | 'delivery_note' | 'other' {
  if (!docType) return 'other';
  const normalized = docType.toLowerCase();
  if (normalized.includes('invoice')) return 'invoice';
  if (normalized.includes('delivery') || normalized.includes('albaran')) return 'delivery_note';
  return 'other';
}

function detectPossibleDuplicateLines(lines: OcrLineDetected[]): OcrPossibleDuplicate[] {
  const hints: OcrPossibleDuplicate[] = [];
  const normalizeDescription = (value: string): string =>
    normalizeProcurementText(
      value
        .replace(/^\s*(?:cod(?:igo)?|ref(?:erencia)?|art(?:iculo)?)\s*[:#-]?\s*[a-z0-9-]{2,16}\s+/i, '')
        .replace(/^\s*[a-z]{1,3}\d{2,8}\s+/i, '')
        .replace(/^\s*\d{4,12}(?:[-/][a-z0-9]{1,8})?\s+/i, ''),
    ) ?? '';

  for (let i = 0; i < lines.length; i += 1) {
    const left = lines[i];
    const leftDesc = normalizeDescription(left.raw_description);
    if (!leftDesc) continue;
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j += 1) {
      const right = lines[j];
      const rightDesc = normalizeDescription(right.raw_description);
      if (!rightDesc) continue;
      const sameDesc = leftDesc === rightDesc || leftDesc.includes(rightDesc) || rightDesc.includes(leftDesc);
      if (!sameDesc) continue;
      const samePrice = left.raw_unit_price !== null && right.raw_unit_price !== null && Math.abs(left.raw_unit_price - right.raw_unit_price) <= 0.001;
      const sameTotal = left.raw_line_total !== null && right.raw_line_total !== null && Math.abs(left.raw_line_total - right.raw_line_total) <= 0.001;
      if (!samePrice && !sameTotal) continue;
      const confidence: 'high' | 'medium' = samePrice && sameTotal ? 'high' : 'medium';
      hints.push({
        line_number: j + 1,
        duplicate_of_line_number: i + 1,
        confidence,
        reason: 'Descripción muy similar con precio/importe coincidente en filas cercanas.',
      });
    }
  }
  return hints;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const azureEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim();
  const azurePollIntervalMs = parsePositiveIntEnv(
    process.env.AZURE_DOCUMENT_INTELLIGENCE_POLL_INTERVAL_MS,
    DEFAULT_AZURE_POLL_INTERVAL_MS,
    250,
  );
  const azurePollTimeoutMs = parsePositiveIntEnv(
    process.env.AZURE_DOCUMENT_INTELLIGENCE_POLL_TIMEOUT_MS,
    DEFAULT_AZURE_POLL_TIMEOUT_MS,
    5_000,
  );
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
  const [
    { data: document, error: documentError },
    { count: currentLinesCount, error: linesError },
    { data: ingredientCandidates, error: ingredientsError },
    { data: supplierCandidates, error: suppliersError },
    { data: supplierProductRefs, error: refsError },
  ] =
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
      supabase.from('cheffing_ingredients').select('id, name, reference').order('name', { ascending: true }),
      supabase.from('cheffing_suppliers').select('id, trade_name, tax_id, email, phone').order('trade_name', { ascending: true }),
      supabase
        .from('cheffing_supplier_product_refs')
        .select('supplier_id, ingredient_id, supplier_product_description, supplier_product_alias, reference_unit_code, reference_format_qty')
        .limit(1000),
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
  let nextPollDelayMs = azurePollIntervalMs;

  while (Date.now() - pollStartedAt < azurePollTimeoutMs) {
    await sleep(nextPollDelayMs);
    nextPollDelayMs = azurePollIntervalMs;
    const pollResponse = await fetch(operationLocation, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
      },
    });

    const payload = (await pollResponse.json().catch(() => null)) as AzureAnalyzeResult | null;
    if (!pollResponse.ok) {
      if (pollResponse.status === 429 || pollResponse.status >= 500) {
        const retryAfterHeader = pollResponse.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
        if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
          nextPollDelayMs = Math.max(azurePollIntervalMs, retryAfterSeconds * 1000);
        }
        continue;
      }
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

  const supplierDetectedRaw = {
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

  const documentNumberFallback = extractDocumentNumberFallback({
    invoiceFieldValue: getFieldString(fields.InvoiceId),
    kvPairs: keyValuePairs,
    rawText,
  });

  const documentDetectedRaw = {
    document_kind: mapDocumentKind(firstDocument?.docType),
    document_number: documentNumberFallback.value,
    document_number_source: documentNumberFallback.source,
    document_date: getFieldDate(fields.InvoiceDate),
    due_date: getFieldDate(fields.DueDate),
    declared_total: getFieldNumber(fields.InvoiceTotal) ?? getFieldNumber(fields.AmountDue),
  };

  const linesFromItems = deriveDetectedLinesFromItems(fields.Items?.valueArray, ingredientCandidates ?? []);
  const linesFromTables = deriveDetectedLinesFromTables(analyzePayload.analyzeResult.tables, ingredientCandidates ?? []);
  const linesDetectedRaw =
    linesFromItems.length === 0 ? linesFromTables : enrichItemsWithTableQuantities(linesFromItems, linesFromTables);
  const supplierCandidatesRetrieved = buildSupplierCandidates({
    supplierDetectedRaw,
    suppliers: (supplierCandidates ?? []) as SupplierCandidateRow[],
  });
  const suggestedExistingSupplier = getSuggestedExistingSupplier(supplierCandidatesRetrieved);
  const lineCandidatesByLineNumber = linesDetectedRaw.map((line, index) =>
    buildLineCandidates({
      lineNumber: index + 1,
      line,
      ingredients: (ingredientCandidates ?? []) as IngredientCandidateRow[],
      supplierProductRefs: (supplierProductRefs ?? []) as SupplierProductRefRow[],
      supplierCandidates: supplierCandidatesRetrieved,
    }),
  );

  const cleanupStartedAt = new Date().toISOString();
  let openAiCleanupPayload: Awaited<ReturnType<typeof runOpenAiOcrCleanup>> | null = null;
  let openAiCleanupMeta: OcrCleanupMeta = {
    provider: 'openai',
    status: 'skipped',
    model: null,
    processed_at: cleanupStartedAt,
    affected_lines: 0,
    warning: 'OpenAI cleanup disabled or missing OPENAI_API_KEY.',
  };

  if (shouldRunOpenAiOcrCleanup()) {
    console.info('[procurement OCR] OpenAI cleanup started', { document_id: params.id, line_count: linesDetectedRaw.length });
    try {
      openAiCleanupPayload = await runOpenAiOcrCleanup({
        documentKind: mapDocumentKind(firstDocument?.docType),
        ocrRawText: rawText,
        lines: linesDetectedRaw.map((line, index) => ({
          line_number: index + 1,
          raw_description: line.raw_description,
          raw_quantity: line.raw_quantity,
          raw_unit: line.raw_unit,
          raw_unit_price: line.raw_unit_price,
          raw_line_total: line.raw_line_total,
          boxes: line.boxes,
          units: line.units,
          product_code: line.product_code,
          warning_notes: line.warning_notes,
        })),
        supplierCandidates: supplierCandidatesRetrieved,
        lineCandidatesByLineNumber,
        ingredientCandidatesFallback: (ingredientCandidates ?? []) as IngredientCandidateRow[],
        supplierCandidatesFallback: (supplierCandidates ?? []) as SupplierCandidateRow[],
        supplierProductRefsFallback: (supplierProductRefs ?? []) as SupplierProductRefRow[],
      });
      openAiCleanupMeta = {
        provider: 'openai',
        status: 'applied',
        model: openAiCleanupPayload.cleanup_meta.model,
        processed_at: openAiCleanupPayload.cleanup_meta.processed_at || new Date().toISOString(),
        affected_lines: openAiCleanupPayload.lines_cleanup.length,
        warning: openAiCleanupPayload.global_warnings.length ? openAiCleanupPayload.global_warnings.join(' ') : null,
      };
      console.info('[procurement OCR] OpenAI cleanup applied', {
        document_id: params.id,
        affected_lines: openAiCleanupMeta.affected_lines,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenAI cleanup failed';
      openAiCleanupMeta = {
        provider: 'openai',
        status: 'failed',
        model: process.env.OPENAI_OCR_CLEANUP_MODEL?.trim() || null,
        processed_at: new Date().toISOString(),
        affected_lines: 0,
        warning: message,
      };
      console.warn('[procurement OCR] OpenAI cleanup failed, degraded to Azure-only', {
        document_id: params.id,
        message,
      });
    }
  } else {
    console.info('[procurement OCR] OpenAI cleanup skipped by config', { document_id: params.id });
  }

  const cleanupByLine = new Map((openAiCleanupPayload?.lines_cleanup ?? []).map((line) => [line.line_number, line]));
  const supplierCleanup = openAiCleanupPayload?.supplier_cleanup;
  const documentCleanup = openAiCleanupPayload?.document_cleanup;
  const hasReliableSupplierCleanup = (supplierCleanup?.confidence ?? 0) >= 0.75;
  const hasReliableDocumentCleanup = (documentCleanup?.confidence ?? 0) >= 0.75;

  const linesDetected: OcrLineDetected[] = linesDetectedRaw.map((line, index): OcrLineDetected => {
    const cleanup = cleanupByLine.get(index + 1);
    if (!cleanup) return line;

    const nextWarnings = [
      line.warning_notes,
      cleanup.warnings.length ? cleanup.warnings.join(' ') : null,
      cleanup.reasoning_short ? `OpenAI: ${cleanup.reasoning_short}` : null,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      ...line,
      warning_notes: nextWarnings.length ? nextWarnings : line.warning_notes,
      ingredient_match:
        cleanup.ingredient_match &&
        cleanup.ingredient_match.ingredient_id &&
        cleanup.ingredient_match.confidence === 'high' &&
        !cleanup.ingredient_match.ambiguous
          ? {
              ingredient_id: cleanup.ingredient_match.ingredient_id,
              ingredient_name: cleanup.ingredient_match.ingredient_name ?? '',
              confidence: 'high' as const,
              reason: cleanup.ingredient_match.match_basis ?? 'OpenAI cleanup match de alta confianza.',
            }
          : line.ingredient_match,
      extraction_source: cleanup.source_trace === 'azure+openai' ? 'items+table' : line.extraction_source,
    };
  });
  const possibleDuplicates = detectPossibleDuplicateLines(linesDetected);
  const duplicateByLineNumber = new Map(possibleDuplicates.map((entry) => [entry.line_number, entry] as const));

  const supplierDetected = {
    ...supplierDetectedRaw,
    name:
      hasReliableSupplierCleanup && supplierCleanup?.cleaned_name
        ? supplierCleanup.cleaned_name
        : supplierDetectedRaw.name,
    trade_name:
      hasReliableSupplierCleanup && supplierCleanup?.cleaned_name
        ? supplierCleanup.cleaned_name
        : supplierDetectedRaw.trade_name,
    legal_name:
      hasReliableSupplierCleanup && supplierCleanup?.cleaned_name
        ? supplierCleanup.cleaned_name
        : supplierDetectedRaw.legal_name,
    tax_id:
      hasReliableSupplierCleanup && supplierCleanup?.cleaned_tax_id
        ? supplierCleanup.cleaned_tax_id
        : supplierDetectedRaw.tax_id,
    email:
      hasReliableSupplierCleanup && supplierCleanup?.cleaned_email
        ? supplierCleanup.cleaned_email
        : supplierDetectedRaw.email,
    phone:
      hasReliableSupplierCleanup && supplierCleanup?.cleaned_phone
        ? supplierCleanup.cleaned_phone
        : supplierDetectedRaw.phone,
  } satisfies OcrSupplierDetected;

  const documentDetected = {
    ...documentDetectedRaw,
    document_number:
      hasReliableDocumentCleanup && documentCleanup?.cleaned_document_number
        ? documentCleanup.cleaned_document_number
        : documentDetectedRaw.document_number,
    document_date:
      hasReliableDocumentCleanup && documentCleanup?.cleaned_document_date
        ? documentCleanup.cleaned_document_date
        : documentDetectedRaw.document_date,
  };

  let supplierEnrichment: SupplierEnrichmentResult | null = null;
  if (suggestedExistingSupplier?.should_auto_select) {
    const { data: matchedSupplier } = await supabase
      .from('cheffing_suppliers')
      .select('id, tax_id, email, phone')
      .eq('id', suggestedExistingSupplier.supplier_id)
      .maybeSingle();

    if (matchedSupplier) {
      const autoFilled: SupplierEnrichmentResult['auto_filled'] = [];
      const conflicts: SupplierEnrichmentResult['conflicts'] = [];
      const supplierUpdates: Record<string, string> = {};

      const fields: Array<{ key: 'tax_id' | 'email' | 'phone'; detectedValue: string | null; existingValue: string | null }> = [
        { key: 'tax_id', detectedValue: supplierDetected.tax_id, existingValue: matchedSupplier.tax_id },
        { key: 'email', detectedValue: supplierDetected.email, existingValue: matchedSupplier.email },
        { key: 'phone', detectedValue: supplierDetected.phone, existingValue: matchedSupplier.phone },
      ];

      for (const field of fields) {
        const detectedTrimmed = field.detectedValue?.trim() ?? null;
        if (!detectedTrimmed) continue;
        const isConfident = isSupplierFieldConfident({
          field: field.key,
          trace: supplierTrace,
          hasReliableSupplierCleanup,
        });
        if (!isConfident) continue;

        const existingTrimmed = field.existingValue?.trim() ?? null;
        if (!existingTrimmed) {
          supplierUpdates[field.key] = detectedTrimmed;
          autoFilled.push({
            field: field.key,
            value: detectedTrimmed,
            source: hasReliableSupplierCleanup ? 'openai_cleanup' : 'ocr',
          });
          continue;
        }

        const existingComparable = normalizedComparableValue(field.key, existingTrimmed);
        const detectedComparable = normalizedComparableValue(field.key, detectedTrimmed);
        if (!existingComparable || !detectedComparable) continue;
        if (existingComparable !== detectedComparable) {
          conflicts.push({
            field: field.key,
            existing_value: existingTrimmed,
            detected_value: detectedTrimmed,
            reason: 'existing_value_differs_detected',
          });
        }
      }

      let appliedAutoFilled = autoFilled;
      let updateAttempt: SupplierEnrichmentResult['update_attempt'] = {
        attempted: false,
        applied: false,
        warning: null,
      };
      if (Object.keys(supplierUpdates).length > 0) {
        updateAttempt = { attempted: true, applied: false, warning: null };
        const { error: supplierUpdateError } = await supabase
          .from('cheffing_suppliers')
          .update(supplierUpdates)
          .eq('id', suggestedExistingSupplier.supplier_id);
        if (supplierUpdateError) {
          appliedAutoFilled = [];
          updateAttempt = {
            attempted: true,
            applied: false,
            warning: `Supplier enrichment update failed: ${supplierUpdateError.message}`,
          };
          console.warn('[procurement OCR] supplier enrichment update failed; auto-fill not applied', {
            document_id: params.id,
            supplier_id: suggestedExistingSupplier.supplier_id,
            attempted_fields: Object.keys(supplierUpdates),
            error: supplierUpdateError.message,
          });
        } else {
          updateAttempt = { attempted: true, applied: true, warning: null };
        }
      }

      supplierEnrichment = {
        supplier_id: suggestedExistingSupplier.supplier_id,
        auto_filled: appliedAutoFilled,
        conflicts,
        update_attempt: updateAttempt,
      };
    }
  }

  const interpretedPayload = {
    supplier_detected: supplierDetected,
    supplier_detected_raw: supplierDetectedRaw,
    supplier_candidates: supplierCandidatesRetrieved,
    supplier_existing_suggestion: suggestedExistingSupplier,
    supplier_enrichment: supplierEnrichment,
    document_detected: documentDetected,
    document_detected_raw: documentDetectedRaw,
    lines_detected: linesDetected,
    lines_detected_raw: linesDetectedRaw,
    possible_duplicates: possibleDuplicates,
    line_candidates_by_line_number: lineCandidatesByLineNumber,
    ocr_meta: {
      provider: 'azure_document_intelligence',
      model: AZURE_MODEL_ID,
      api_version: AZURE_API_VERSION,
      source: 'signed_url',
      processed_at: new Date().toISOString(),
      rerun_blocked_if_lines_exist: true as const,
      supplier_trace: supplierTrace,
      document_number_trace: {
        source: documentNumberFallback.source,
        fallback_used: documentNumberFallback.source !== 'invoice_field' && documentNumberFallback.source !== 'none',
      },
    },
    openai_cleanup: openAiCleanupPayload,
    cleanup_meta: openAiCleanupMeta,
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
    const rows = linesDetected.map((line, index) => {
      const cleanup = cleanupByLine.get(index + 1);
      const interpretedDescription = cleanup?.cleaned_description?.trim() || line.raw_description;
      const interpretedQuantity = cleanup?.quantity_interpreted ?? line.raw_quantity;
      const interpretedUnit = cleanup?.unit_interpreted?.trim() || line.raw_unit;
      const normalizedUnitCode = cleanup?.canonical_unit ?? line.validated_unit;
      const normalizedUnitPrice = cleanup?.unit_price_interpreted ?? line.raw_unit_price;
      const normalizedLineTotal = cleanup?.line_total_interpreted ?? line.raw_line_total;
      const openAiSuggestedIngredientId =
        cleanup?.ingredient_match &&
        cleanup.ingredient_match.ingredient_id &&
        cleanup.ingredient_match.confidence === 'high' &&
        !cleanup.ingredient_match.ambiguous
          ? cleanup.ingredient_match.ingredient_id
          : null;

      const duplicateHint = duplicateByLineNumber.get(index + 1);
      return {
        document_id: params.id,
        line_number: index + 1,
        raw_description: line.raw_description,
        raw_quantity: line.raw_quantity,
        raw_unit: line.raw_unit,
        validated_unit: line.validated_unit,
        raw_unit_price: line.raw_unit_price,
        raw_line_total: line.raw_line_total,
        interpreted_description: interpretedDescription,
        interpreted_quantity: interpretedQuantity,
        interpreted_unit: interpretedUnit,
        normalized_quantity: interpretedQuantity,
        normalized_unit_code: normalizedUnitCode,
        normalized_unit_price: normalizedUnitPrice,
        normalized_line_total: normalizedLineTotal,
        suggested_ingredient_id:
          line.ingredient_match?.confidence === 'high'
            ? line.ingredient_match.ingredient_id
            : openAiSuggestedIngredientId,
        line_status: 'unresolved' as const,
        warning_notes: [line.warning_notes, duplicateHint ? `possible_duplicate(line #${duplicateHint.duplicate_of_line_number}, ${duplicateHint.confidence})` : null].filter(Boolean).join(' ') || null,
        user_note: null,
      };
    });

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
  if (suppliersError) {
    console.warn('[procurement OCR] suppliers list not available for OpenAI cleanup context', suppliersError.message);
  }
  if (refsError) {
    console.warn('[procurement OCR] supplier refs not available for OpenAI cleanup context', refsError.message);
  }

  const response = NextResponse.json({
    ok: true,
    inserted_lines: insertedLines,
    lines_detected_count: linesDetected.length,
    supplier_detected: supplierDetected,
    supplier_existing_suggestion: suggestedExistingSupplier,
    supplier_enrichment: supplierEnrichment,
    cleanup_meta: openAiCleanupMeta,
    possible_duplicates: possibleDuplicates,
  });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
