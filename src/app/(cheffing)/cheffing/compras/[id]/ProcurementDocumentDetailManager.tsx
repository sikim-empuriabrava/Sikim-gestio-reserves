'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  documentKindLabel,
  documentStatusLabel,
  inferProcurementSourceFileKind,
  lineStatusLabel,
  normalizeProcurementCanonicalUnit,
  PROCUREMENT_CANONICAL_UNITS,
  PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES,
  type ProcurementDocumentKind,
  type ProcurementCanonicalUnit,
} from '@/lib/cheffing/procurement';

type Ingredient = { id: string; name: string };
type Supplier = { id: string; trade_name: string; tax_id?: string | null; email?: string | null; phone?: string | null };
type Unit = { code: string; name: string };

type Line = {
  id: string;
  line_number: number;
  raw_description: string;
  interpreted_description?: string | null;
  raw_quantity: number | null;
  raw_unit: string | null;
  interpreted_quantity: number | null;
  interpreted_unit: string | null;
  normalized_unit_code: string | null;
  validated_unit: ProcurementCanonicalUnit | null;
  raw_unit_price: number | null;
  raw_line_total: number | null;
  suggested_ingredient_id: string | null;
  validated_ingredient_id: string | null;
  line_status: 'unresolved' | 'resolved';
  warning_notes: string | null;
  user_note: string | null;
  validated_ingredient: { name: string | null } | { name: string | null }[] | null;
};

type Doc = {
  id: string;
  supplier_id: string | null;
  document_kind: ProcurementDocumentKind;
  document_number: string | null;
  document_date: string;
  effective_at: string | null;
  status: 'draft' | 'applied' | 'discarded';
  validation_notes: string | null;
  declared_total: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  ocr_raw_text: string | null;
  interpreted_payload: Record<string, unknown> | null;
  applied_at: string | null;
  applied_by: string | null;
  created_at?: string | null;
  cheffing_purchase_document_lines: Line[] | null;
};

type SupplierExistingSuggestionView = {
  supplierId: string;
  tradeName: string;
  scoreHint: number;
  shouldAutoSelect: boolean;
  isStrongMatch: boolean;
  isDominant: boolean;
  dominanceGap: number | null;
  reasons: string[];
  matchTrace: string[];
  detectedNameNormalized: string | null;
  supplierNameNormalized: string | null;
};

type SupplierEnrichmentView = {
  supplierId: string;
  autoFilled: Array<{ field: string; value: string }>;
  conflicts: Array<{ field: string; existing_value: string; detected_value: string }>;
  status:
    | 'skipped_not_attempted'
    | 'skipped_no_supplier_detected'
    | 'matched_no_new_data'
    | 'attempted_applied'
    | 'attempted_failed'
    | 'matched_conflicts_only'
    | 'unknown';
  summary: string;
  updateAttempt: {
    attempted: boolean;
    applied: boolean;
    warning: string | null;
  };
};

function supplierEnrichmentStatusMessage(status: string): string {
  switch (status) {
    case 'matched_no_new_data':
      return 'No había datos nuevos que enriquecer.';
    case 'skipped_not_attempted':
      return 'No se intentó enriquecer todavía (proveedor sugerido sin confirmación automática).';
    case 'skipped_no_supplier_detected':
      return 'No hay proveedor existente sugerido para enriquecer.';
    case 'attempted_failed':
      return 'Se intentó enriquecer, pero falló la actualización.';
    case 'matched_conflicts_only':
      return 'Se detectaron conflictos y no se sobreescribió ningún dato.';
    case 'attempted_applied':
      return 'Enriquecimiento aplicado correctamente.';
    default:
      return 'Sin detalle de enriquecimiento.';
  }
}

function parseSupplierEnrichmentStatus(raw: unknown): SupplierEnrichmentView['status'] {
  return raw === 'skipped_not_attempted' ||
    raw === 'skipped_no_supplier_detected' ||
    raw === 'matched_no_new_data' ||
    raw === 'attempted_applied' ||
    raw === 'attempted_failed' ||
    raw === 'matched_conflicts_only'
    ? raw
    : 'unknown';
}

type DuplicateHint = {
  lineNumber: number;
  duplicateOfLineNumber: number;
  hintType: 'duplicate' | 'possible_shadow_code_line';
  confidence: 'high' | 'medium';
  reason: string;
};

type LineSuggestionHint = {
  suggestedIngredientId: string;
  suggestedIngredientName: string | null;
  scoreHint: number | null;
  reasonLabel: string | null;
  topReasons: string[];
  hasAmbiguousTopMatch: boolean;
  hasNoStrongMatch: boolean;
  candidatesCount: number;
  isManualSuggestionCandidate: boolean;
  isAutoHighConfidence: boolean;
};

const emptyLine = {
  raw_description: '',
  raw_quantity: '',
  raw_unit: '',
  validated_unit: '',
  raw_unit_price: '',
  raw_line_total: '',
  validated_ingredient_id: '',
  user_note: '',
};

const emptySupplierForm = {
  trade_name: '',
  legal_name: '',
  tax_id: '',
  phone: '',
  email: '',
};

function lineToFormSnapshot(line: Line) {
  const inferredCanonicalUnit = normalizeProcurementCanonicalUnit(line.validated_unit ?? line.normalized_unit_code ?? line.interpreted_unit ?? '');
  return {
    raw_description: line.raw_description,
    raw_quantity: line.raw_quantity?.toString() ?? '',
    raw_unit: line.raw_unit ?? '',
    validated_unit: typeof inferredCanonicalUnit === 'string' ? inferredCanonicalUnit : '',
    raw_unit_price: line.raw_unit_price?.toString() ?? '',
    raw_line_total: line.raw_line_total?.toString() ?? '',
    validated_ingredient_id: line.validated_ingredient_id ?? '',
    user_note: line.user_note ?? '',
  };
}

function hasLineSnapshotChanges(current: ReturnType<typeof lineToFormSnapshot>, persisted: ReturnType<typeof lineToFormSnapshot>): boolean {
  return (
    current.raw_description !== persisted.raw_description ||
    current.raw_quantity !== persisted.raw_quantity ||
    current.raw_unit !== persisted.raw_unit ||
    current.validated_unit !== persisted.validated_unit ||
    current.raw_unit_price !== persisted.raw_unit_price ||
    current.raw_line_total !== persisted.raw_line_total ||
    current.validated_ingredient_id !== persisted.validated_ingredient_id ||
    current.user_note !== persisted.user_note
  );
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function normalizeNullableText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function parseNullableNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized.length) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseSupplierExistingSuggestion(payload: Record<string, unknown> | null): SupplierExistingSuggestionView | null {
  if (!payload) return null;
  const raw = payload.supplier_existing_suggestion;
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.supplier_id !== 'string') return null;
  return {
    supplierId: record.supplier_id,
    tradeName: typeof record.trade_name === 'string' ? record.trade_name : 'Proveedor sugerido',
    scoreHint: typeof record.score_hint === 'number' ? record.score_hint : 0,
    shouldAutoSelect: record.should_auto_select === true,
    isStrongMatch: record.is_strong_match === true,
    isDominant: record.is_dominant === true,
    dominanceGap: typeof record.dominance_gap === 'number' ? record.dominance_gap : null,
    reasons: Array.isArray(record.match_reasons) ? record.match_reasons.filter((entry): entry is string => typeof entry === 'string') : [],
    matchTrace: Array.isArray(record.match_trace) ? record.match_trace.filter((entry): entry is string => typeof entry === 'string') : [],
    detectedNameNormalized: typeof record.detected_name_normalized === 'string' ? record.detected_name_normalized : null,
    supplierNameNormalized: typeof record.supplier_trade_name_normalized === 'string' ? record.supplier_trade_name_normalized : null,
  };
}

function sortLinesByNumberAsc(lines: Line[]): Line[] {
  return [...lines].sort((a, b) => a.line_number - b.line_number);
}

function parseDetectedDocument(payload: Record<string, unknown> | null): { documentNumber: string; documentDate: string; declaredTotal: string } {
  const detected = payload?.document_detected;
  if (!detected || typeof detected !== 'object') {
    return { documentNumber: '', documentDate: '', declaredTotal: '' };
  }
  const record = detected as Record<string, unknown>;
  return {
    documentNumber: typeof record.document_number === 'string' ? record.document_number : '',
    documentDate: typeof record.document_date === 'string' ? record.document_date : '',
    declaredTotal: typeof record.declared_total === 'number' && Number.isFinite(record.declared_total) ? String(record.declared_total) : '',
  };
}

function resolveDraftHeaderValue(params: {
  persisted: string | null;
  detected: string;
  documentCreatedAt?: string | null;
  documentEffectiveAt?: string | null;
  kind: 'document_number' | 'document_date';
}): string {
  const persisted = params.persisted?.trim() ?? '';
  const detected = params.detected.trim();
  if (!detected) return persisted;
  if (!persisted) return detected;
  if (params.kind === 'document_date' && params.documentCreatedAt) {
    const createdDate = params.documentCreatedAt.slice(0, 10);
    if (persisted === createdDate && detected !== persisted) {
      return detected;
    }
  }
  if (params.kind === 'document_date' && params.documentEffectiveAt) {
    const effectiveDate = params.documentEffectiveAt.slice(0, 10);
    const createdDate = params.documentCreatedAt?.slice(0, 10) ?? null;
    const effectiveLooksInherited = Boolean(createdDate) && createdDate === effectiveDate;
    if (effectiveLooksInherited && persisted === effectiveDate && detected !== persisted) {
      return detected;
    }
  }
  return persisted;
}

export function ProcurementDocumentDetailManager({
  document,
  suppliers,
  ingredients,
  units,
  initialSourceFileUrl,
}: {
  document: Doc;
  suppliers: Supplier[];
  ingredients: Ingredient[];
  units: Unit[];
  initialSourceFileUrl: string | null;
}) {
  const router = useRouter();
  const interpretedPayload = (document.interpreted_payload && typeof document.interpreted_payload === 'object'
    ? document.interpreted_payload
    : null) as Record<string, unknown> | null;
  const detectedSupplierRecord =
    interpretedPayload?.supplier_detected && typeof interpretedPayload.supplier_detected === 'object'
      ? (interpretedPayload.supplier_detected as Record<string, unknown>)
      : null;
  const detectedDocument = useMemo(() => parseDetectedDocument(interpretedPayload), [interpretedPayload]);

  const possibleDocumentDuplicate = useMemo(() => {
    const candidate = interpretedPayload?.possible_document_duplicate;
    if (!candidate || typeof candidate !== 'object') return null;
    const typed = candidate as Record<string, unknown>;
    const status = typed.status === 'possible_duplicate' ? 'possible_duplicate' : 'none';
    const reasons = Array.isArray(typed.reasons) ? typed.reasons.filter((entry): entry is string => typeof entry === 'string') : [];
    const candidateDocumentIds = Array.isArray(typed.candidate_document_ids)
      ? typed.candidate_document_ids.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const checkedAt = typeof typed.checked_at === 'string' ? typed.checked_at : null;
    return {
      status,
      reasons,
      candidateDocumentIds,
      score: typeof typed.score === 'number' ? typed.score : 0,
      checkedAt,
    };
  }, [interpretedPayload]);
  const suggestedExistingSupplier = parseSupplierExistingSuggestion(interpretedPayload);
  const defaultSupplierId =
    document.supplier_id ??
    (suggestedExistingSupplier?.shouldAutoSelect ? suggestedExistingSupplier.supplierId : null);
  const resolveSupplierContactPrefill = useCallback(
    (supplierId: string) => {
      const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId) ?? null;
      return {
        tax_id: selectedSupplier?.tax_id ?? (typeof detectedSupplierRecord?.tax_id === 'string' ? detectedSupplierRecord.tax_id : ''),
        email: selectedSupplier?.email ?? (typeof detectedSupplierRecord?.email === 'string' ? detectedSupplierRecord.email : ''),
        phone: selectedSupplier?.phone ?? (typeof detectedSupplierRecord?.phone === 'string' ? detectedSupplierRecord.phone : ''),
      };
    },
    [detectedSupplierRecord, suppliers],
  );
  const [header, setHeader] = useState({
    document_kind: document.document_kind,
    document_number:
      document.status === 'draft'
        ? resolveDraftHeaderValue({
            persisted: document.document_number,
            detected: detectedDocument.documentNumber,
            documentCreatedAt: document.created_at,
            documentEffectiveAt: document.effective_at,
            kind: 'document_number',
          })
        : (document.document_number ?? ''),
    document_date:
      document.status === 'draft'
        ? resolveDraftHeaderValue({
            persisted: document.document_date,
            detected: detectedDocument.documentDate,
            documentCreatedAt: document.created_at,
            documentEffectiveAt: document.effective_at,
            kind: 'document_date',
          })
        : document.document_date,
    supplier_id: defaultSupplierId ?? '',
    supplier_tax_id: resolveSupplierContactPrefill(defaultSupplierId ?? '').tax_id,
    supplier_email: resolveSupplierContactPrefill(defaultSupplierId ?? '').email,
    supplier_phone: resolveSupplierContactPrefill(defaultSupplierId ?? '').phone,
    validation_notes: document.validation_notes ?? '',
    declared_total: document.declared_total?.toString() ?? (document.status === 'draft' ? detectedDocument.declaredTotal : ''),
  });
  const [newLine, setNewLine] = useState(emptyLine);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceFileUrl, setSourceFileUrl] = useState<string | null>(initialSourceFileUrl);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingLineIds, setSavingLineIds] = useState<Set<string>>(new Set());
  const [deletingLineIds, setDeletingLineIds] = useState<Set<string>>(new Set());
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [newSupplierForm, setNewSupplierForm] = useState(emptySupplierForm);
  const [isCreatingIngredient, setIsCreatingIngredient] = useState<null | { lineId: string; name: string; unitCode: string; packQty: string; price: string; lineSnapshot: ReturnType<typeof lineToFormSnapshot> }>(null);
  const [localIngredients, setLocalIngredients] = useState<Ingredient[]>(ingredients);
  const [localLines, setLocalLines] = useState<Line[]>(sortLinesByNumberAsc(document.cheffing_purchase_document_lines ?? []));
  const localLinesRef = useRef<Line[]>(sortLinesByNumberAsc(document.cheffing_purchase_document_lines ?? []));
  const [modelDirtyLineIds, setModelDirtyLineIds] = useState<Set<string>>(new Set());
  const [formDirtyLineIds, setFormDirtyLineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalIngredients(ingredients);
  }, [ingredients]);

  useEffect(() => {
    const nextLines = sortLinesByNumberAsc(document.cheffing_purchase_document_lines ?? []);
    setLocalLines(nextLines);
    localLinesRef.current = nextLines;
    setModelDirtyLineIds(new Set());
    setFormDirtyLineIds(new Set());
    setSavingLineIds(new Set());
    setDeletingLineIds(new Set());
  }, [document.cheffing_purchase_document_lines]);

  useEffect(() => {
    localLinesRef.current = localLines;
  }, [localLines]);

  const lines = localLines;
  const hasDirtyLines = modelDirtyLineIds.size > 0 || formDirtyLineIds.size > 0;
  const isDraft = document.status === 'draft';
  const linesCount = lines.length;
  const calculatedLinesTotal = lines.reduce((sum, line) => sum + (line.raw_line_total ?? 0), 0);
  const declaredTotalNumber = parseNullableNumber(header.declared_total);
  const totalsDelta =
    declaredTotalNumber !== null && Number.isFinite(declaredTotalNumber) ? Number((declaredTotalNumber - calculatedLinesTotal).toFixed(2)) : null;
  const hasUnresolvedLines = lines.some((line) => line.line_status !== 'resolved');
  const hasLinesWithoutIngredient = lines.some((line) => !line.validated_ingredient_id);
  const hasLinesWithoutApplicableCost = lines.some((line) => line.raw_unit_price === null);
  const sourceFileKind = inferProcurementSourceFileKind(document.storage_path);
  const persistedSupplierData = suppliers.find((supplier) => supplier.id === document.supplier_id) ?? null;
  const initialHeaderSupplierTaxId = persistedSupplierData?.tax_id ?? (typeof detectedSupplierRecord?.tax_id === 'string' ? detectedSupplierRecord.tax_id : '');
  const initialHeaderSupplierEmail = persistedSupplierData?.email ?? (typeof detectedSupplierRecord?.email === 'string' ? detectedSupplierRecord.email : '');
  const initialHeaderSupplierPhone = persistedSupplierData?.phone ?? (typeof detectedSupplierRecord?.phone === 'string' ? detectedSupplierRecord.phone : '');

  const hasUnsavedHeaderChanges =
    header.supplier_id !== (document.supplier_id ?? '') ||
    header.document_kind !== document.document_kind ||
    normalizeNullableText(header.document_number) !== (document.document_number ?? null) ||
    header.document_date !== document.document_date ||
    normalizeNullableText(header.validation_notes) !== (document.validation_notes ?? null) ||
    parseNullableNumber(header.declared_total) !== (document.declared_total ?? null) ||
    normalizeNullableText(header.supplier_tax_id) !== normalizeNullableText(initialHeaderSupplierTaxId) ||
    normalizeNullableText(header.supplier_email) !== normalizeNullableText(initialHeaderSupplierEmail) ||
    normalizeNullableText(header.supplier_phone) !== normalizeNullableText(initialHeaderSupplierPhone);

  const hasPendingSupplierSelection =
    !document.supplier_id && Boolean(header.supplier_id) && header.supplier_id !== document.supplier_id;
  const createSupplierBlockedReason = hasUnsavedHeaderChanges
    ? 'Guarda primero la cabecera (hay cambios pendientes) para evitar crear proveedor con contexto desactualizado.'
    : null;

  const readinessReasons = [
    !document.supplier_id ? 'Falta proveedor confirmado en DB (guarda cabecera para confirmar proveedor).' : null,
    !lines.length ? 'No hay líneas en el documento.' : null,
    hasDirtyLines ? 'Hay líneas con cambios pendientes de guardar.' : null,
    hasUnresolvedLines ? 'Hay líneas pendientes de resolver.' : null,
    hasLinesWithoutIngredient ? 'Hay líneas sin ingrediente validado.' : null,
    hasLinesWithoutApplicableCost ? 'Hay líneas sin coste aplicable (raw_unit_price).' : null,
    hasUnsavedHeaderChanges ? 'Guarda la cabecera antes de aplicar el documento.' : null,
  ].filter(Boolean) as string[];
  const canApply = isDraft && readinessReasons.length === 0 && !hasUnsavedHeaderChanges;

  const persistedSupplierLabel = useMemo(
    () => suppliers.find((supplier) => supplier.id === document.supplier_id)?.trade_name ?? null,
    [document.supplier_id, suppliers],
  );
  const selectedSupplierLabel = useMemo(
    () => suppliers.find((supplier) => supplier.id === header.supplier_id)?.trade_name ?? null,
    [header.supplier_id, suppliers],
  );

  const detectedSupplier = useMemo(() => {
    const supplier = interpretedPayload?.supplier_detected as Record<string, unknown> | undefined;
    if (!supplier || typeof supplier !== 'object') return null;

    return {
      name: typeof supplier.name === 'string' ? supplier.name : null,
      taxId: typeof supplier.tax_id === 'string' ? supplier.tax_id : null,
      email: typeof supplier.email === 'string' ? supplier.email : null,
      phone: typeof supplier.phone === 'string' ? supplier.phone : null,
      matchHint: typeof supplier.match_hint === 'string' ? supplier.match_hint : null,
    };
  }, [interpretedPayload]);

  const cleanupMeta = useMemo(() => {
    const payload = interpretedPayload;
    if (!payload || typeof payload !== 'object') return null;
    const meta = (payload as Record<string, unknown>).cleanup_meta;
    if (!meta || typeof meta !== 'object') return null;
    const record = meta as Record<string, unknown>;
    return {
      status: typeof record.status === 'string' ? record.status : null,
      warning: typeof record.warning === 'string' ? record.warning : null,
      model: typeof record.model === 'string' ? record.model : null,
      affectedLines: typeof record.affected_lines === 'number' ? record.affected_lines : null,
    };
  }, [interpretedPayload]);

  const supplierPrefill = useMemo(() => {
    const supplier = interpretedPayload?.supplier_detected as Record<string, unknown> | undefined;
    if (!supplier || typeof supplier !== 'object') return emptySupplierForm;

    return {
      trade_name:
        typeof supplier.trade_name === 'string'
          ? supplier.trade_name
          : typeof supplier.name === 'string'
            ? supplier.name
            : '',
      legal_name: typeof supplier.legal_name === 'string' ? supplier.legal_name : '',
      tax_id: typeof supplier.tax_id === 'string' ? supplier.tax_id : '',
      phone: typeof supplier.phone === 'string' ? supplier.phone : '',
      email: typeof supplier.email === 'string' ? supplier.email : '',
    };
  }, [interpretedPayload]);

  const supplierEnrichment = useMemo<SupplierEnrichmentView | null>(() => {
    const raw = interpretedPayload?.supplier_enrichment;
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    const autoFilled = Array.isArray(record.auto_filled)
      ? record.auto_filled.filter((entry): entry is { field: string; value: string } => {
          if (!entry || typeof entry !== 'object') return false;
          const typed = entry as Record<string, unknown>;
          return typeof typed.field === 'string' && typeof typed.value === 'string';
        })
      : [];
    const conflicts = Array.isArray(record.conflicts)
      ? record.conflicts.filter((entry): entry is { field: string; existing_value: string; detected_value: string } => {
          if (!entry || typeof entry !== 'object') return false;
          const typed = entry as Record<string, unknown>;
          return typeof typed.field === 'string' && typeof typed.existing_value === 'string' && typeof typed.detected_value === 'string';
        })
      : [];
    const updateAttemptRecord =
      record.update_attempt && typeof record.update_attempt === 'object'
        ? (record.update_attempt as Record<string, unknown>)
        : null;
    return {
      supplierId: typeof record.supplier_id === 'string' ? record.supplier_id : '',
      autoFilled,
      conflicts,
      status: parseSupplierEnrichmentStatus(record.status),
      summary: typeof record.summary === 'string' ? record.summary : 'Sin detalle de enriquecimiento.',
      updateAttempt: {
        attempted: updateAttemptRecord?.attempted === true,
        applied: updateAttemptRecord?.applied === true,
        warning: typeof updateAttemptRecord?.warning === 'string' ? updateAttemptRecord.warning : null,
      },
    };
  }, [interpretedPayload]);

  const lineSuggestionHintByLineNumber = useMemo(() => {
    const out = new Map<number, LineSuggestionHint>();
    const entries = interpretedPayload?.line_candidates_by_line_number;
    if (!Array.isArray(entries)) return out;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      if (typeof record.line_number !== 'number' || !Array.isArray(record.candidates)) continue;
      const top = record.candidates[0];
      if (!top || typeof top !== 'object') continue;
      const topRecord = top as Record<string, unknown>;
      const reasons = Array.isArray(topRecord.match_reasons) ? topRecord.match_reasons.filter((reason): reason is string => typeof reason === 'string') : [];
      const ingredientName = typeof topRecord.ingredient_name === 'string' ? topRecord.ingredient_name : null;
      const suggestedIngredientId = typeof topRecord.ingredient_id === 'string' ? topRecord.ingredient_id : null;
      if (!suggestedIngredientId) continue;
      const candidatesCount = record.candidates.length;
      const second = record.candidates[1];
      const secondRecord = second && typeof second === 'object' ? (second as Record<string, unknown>) : null;
      const topScoreHint = typeof topRecord.score_hint === 'number' ? topRecord.score_hint : null;
      const secondScoreHint = typeof secondRecord?.score_hint === 'number' ? secondRecord.score_hint : null;
      const scoreGap = topScoreHint !== null && secondScoreHint !== null ? topScoreHint - secondScoreHint : null;
      const hasAmbiguousTopMatch = candidatesCount > 1 && scoreGap !== null && scoreGap < 12;
      out.set(record.line_number, {
        suggestedIngredientId,
        suggestedIngredientName: ingredientName,
        scoreHint: topScoreHint,
        reasonLabel: reasons.length > 0 ? reasons.slice(0, 3).join(', ') : null,
        topReasons: reasons,
        hasAmbiguousTopMatch,
        hasNoStrongMatch: candidatesCount === 0 || topScoreHint === null || topScoreHint < 66,
        candidatesCount,
        isManualSuggestionCandidate: topRecord.is_manual_suggestion_candidate === true,
        isAutoHighConfidence: topRecord.is_auto_high_confidence === true,
      });
    }
    return out;
  }, [interpretedPayload]);

  const totalsInsight = useMemo(() => {
    const detectedDocumentRecord = interpretedPayload?.document_detected;
    const detectedDocument =
      detectedDocumentRecord && typeof detectedDocumentRecord === 'object'
        ? (detectedDocumentRecord as Record<string, unknown>)
        : null;
    const lineSubtotal = calculatedLinesTotal;
    const headerSubtotalDetected = typeof detectedDocument?.subtotal_detected === 'number' ? detectedDocument.subtotal_detected : null;
    const vatDetectedRaw = typeof detectedDocument?.vat_total_detected === 'number' ? detectedDocument.vat_total_detected : null;
    const vatDetected = vatDetectedRaw !== null && Number.isFinite(vatDetectedRaw) ? vatDetectedRaw : null;
    const deltaLinesVsHeaderSubtotal =
      headerSubtotalDetected !== null ? Number((lineSubtotal - headerSubtotalDetected).toFixed(2)) : null;
    const vatEstimatedFromDelta =
      vatDetected === null &&
      declaredTotalNumber !== null && Number.isFinite(declaredTotalNumber) ? Number((declaredTotalNumber - lineSubtotal).toFixed(2)) : null;
    const expectedGrossWithDetectedVat =
      declaredTotalNumber !== null && vatDetected !== null ? Number((lineSubtotal + vatDetected).toFixed(2)) : null;
    const grossDeltaReal =
      declaredTotalNumber !== null && expectedGrossWithDetectedVat !== null
        ? Number((declaredTotalNumber - expectedGrossWithDetectedVat).toFixed(2))
        : totalsDelta;
    const vatLikelyExplainsDelta =
      vatDetected !== null &&
      totalsDelta !== null &&
      grossDeltaReal !== null &&
      Math.abs(totalsDelta - vatDetected) <= 0.05 &&
      Math.abs(grossDeltaReal) <= 0.05;
    return {
      lineSubtotal,
      headerSubtotalDetected,
      deltaLinesVsHeaderSubtotal,
      vatDetected,
      vatEstimatedFromDelta,
      grossDeltaReal,
      vatLikelyExplainsDelta,
    };
  }, [calculatedLinesTotal, declaredTotalNumber, interpretedPayload, totalsDelta]);

  const duplicateHintByLineNumber = useMemo(() => {
    const out = new Map<number, DuplicateHint>();
    const entries = interpretedPayload?.possible_duplicates;
    if (!Array.isArray(entries)) return out;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const typed = entry as Record<string, unknown>;
      if (typeof typed.line_number !== 'number' || typeof typed.duplicate_of_line_number !== 'number' || typeof typed.reason !== 'string') continue;
      out.set(typed.line_number, {
        lineNumber: typed.line_number,
        duplicateOfLineNumber: typed.duplicate_of_line_number,
        hintType: typed.hint_type === 'possible_shadow_code_line' ? 'possible_shadow_code_line' : 'duplicate',
        confidence: typed.confidence === 'high' ? 'high' : 'medium',
        reason: typed.reason,
      });
    }
    return out;
  }, [interpretedPayload]);

  function setLineDirty(setter: (value: Set<string> | ((current: Set<string>) => Set<string>)) => void, lineId: string, dirty: boolean) {
    setter((current) => {
      const alreadyDirty = current.has(lineId);
      if (alreadyDirty === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(lineId);
      else next.delete(lineId);
      return next;
    });
  }
  function setLineBusy(setter: (value: Set<string> | ((current: Set<string>) => Set<string>)) => void, lineId: string, busy: boolean) {
    setter((current) => {
      const alreadyBusy = current.has(lineId);
      if (alreadyBusy === busy) return current;
      const next = new Set(current);
      if (busy) next.add(lineId);
      else next.delete(lineId);
      return next;
    });
  }

  const handleFormDirtyChange = useCallback((lineId: string, dirty: boolean) => {
    setLineDirty(setFormDirtyLineIds, lineId, dirty);
  }, []);

  function openNewSupplierForm() {
    if (hasUnsavedHeaderChanges) return;
    setNewSupplierForm(supplierPrefill);
    setIsCreatingSupplier(true);
    setError(null);
  }

  function cancelNewSupplierForm() {
    setIsCreatingSupplier(false);
    setNewSupplierForm(emptySupplierForm);
  }

  async function saveHeader() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_kind: header.document_kind,
          document_number: header.document_number,
          document_date: header.document_date,
          supplier_id: header.supplier_id || null,
          supplier_contact_updates: {
            tax_id: header.supplier_tax_id || null,
            email: header.supplier_email || null,
            phone: header.supplier_phone || null,
          },
          validation_notes: header.validation_notes,
          declared_total: header.declared_total ? Number(header.declared_total) : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo guardar cabecera');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmSuggestedSupplierAndSave() {
    if (!suggestedExistingSupplier?.shouldAutoSelect) return;
    const prefill = resolveSupplierContactPrefill(suggestedExistingSupplier.supplierId);
    const nextHeader = { ...header, supplier_id: suggestedExistingSupplier.supplierId, supplier_tax_id: prefill.tax_id, supplier_email: prefill.email, supplier_phone: prefill.phone };
    setHeader(nextHeader);
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_kind: nextHeader.document_kind,
          document_number: nextHeader.document_number,
          document_date: nextHeader.document_date,
          supplier_id: nextHeader.supplier_id || null,
          supplier_contact_updates: {
            tax_id: nextHeader.supplier_tax_id || null,
            email: nextHeader.supplier_email || null,
            phone: nextHeader.supplier_phone || null,
          },
          validation_notes: nextHeader.validation_notes,
          declared_total: nextHeader.declared_total ? Number(nextHeader.declared_total) : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo confirmar proveedor sugerido');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createAndAssignSupplier() {
    const tradeName = newSupplierForm.trade_name.trim();
    if (!tradeName) {
      setError('El nombre comercial (trade_name) es obligatorio.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const createResponse = await fetch('/api/cheffing/procurement/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_name: tradeName,
          legal_name: newSupplierForm.legal_name,
          tax_id: newSupplierForm.tax_id,
          phone: newSupplierForm.phone,
          email: newSupplierForm.email,
        }),
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        throw new Error(createPayload?.error ?? 'No se pudo crear proveedor');
      }

      const newSupplierId = typeof createPayload?.id === 'string' ? createPayload.id : null;
      if (!newSupplierId) {
        throw new Error('No se recibió id del proveedor creado.');
      }

      const assignResponse = await fetch(`/api/cheffing/procurement/documents/${document.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: newSupplierId }),
      });

      const assignPayload = await assignResponse.json().catch(() => ({}));
      if (!assignResponse.ok) {
        throw new Error(assignPayload?.error ?? 'No se pudo asignar el proveedor al documento');
      }

      setHeader((current) => ({
        ...current,
        supplier_id: newSupplierId,
        supplier_tax_id: newSupplierForm.tax_id.trim(),
        supplier_email: newSupplierForm.email.trim(),
        supplier_phone: newSupplierForm.phone.trim(),
      }));
      setIsCreatingSupplier(false);
      setNewSupplierForm(emptySupplierForm);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function uploadSourceFile() {
    if (!fileToUpload) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('file', fileToUpload);

      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/source-file`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? 'No se pudo subir el archivo original');
      }

      if (typeof payload.sourceFileUrl === 'string') {
        setSourceFileUrl(payload.sourceFileUrl);
      }
      setFileToUpload(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addLine() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_description: newLine.raw_description,
          raw_quantity: newLine.raw_quantity ? Number(newLine.raw_quantity) : null,
          raw_unit: newLine.raw_unit,
          validated_unit: newLine.validated_unit || null,
          raw_unit_price: newLine.raw_unit_price ? Number(newLine.raw_unit_price) : null,
          raw_line_total: newLine.raw_line_total ? Number(newLine.raw_line_total) : null,
          validated_ingredient_id: newLine.validated_ingredient_id || null,
          line_status: newLine.validated_ingredient_id ? 'resolved' : 'unresolved',
          user_note: newLine.user_note,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? 'No se pudo crear la línea');
      }
      const createdId = typeof payload?.id === 'string' ? payload.id : null;
      const nextLineNumber = lines.length > 0 ? Math.max(...lines.map((line) => line.line_number)) + 1 : 1;
      if (createdId) {
        setLocalLines((current) =>
          sortLinesByNumberAsc([
            ...current,
            {
              id: createdId,
              line_number: nextLineNumber,
              raw_description: newLine.raw_description,
              interpreted_description: null,
              raw_quantity: newLine.raw_quantity ? Number(newLine.raw_quantity) : null,
              raw_unit: newLine.raw_unit || null,
              interpreted_quantity: null,
              interpreted_unit: null,
              normalized_unit_code: newLine.validated_unit || null,
              validated_unit: (newLine.validated_unit || null) as ProcurementCanonicalUnit | null,
              raw_unit_price: newLine.raw_unit_price ? Number(newLine.raw_unit_price) : null,
              raw_line_total: newLine.raw_line_total ? Number(newLine.raw_line_total) : null,
              suggested_ingredient_id: null,
              validated_ingredient_id: newLine.validated_ingredient_id || null,
              line_status: newLine.validated_ingredient_id ? 'resolved' : 'unresolved',
              warning_notes: null,
              user_note: newLine.user_note || null,
              validated_ingredient: newLine.validated_ingredient_id
                ? { name: localIngredients.find((ingredient) => ingredient.id === newLine.validated_ingredient_id)?.name ?? null }
                : null,
            },
          ]),
        );
        setLineDirty(setModelDirtyLineIds, createdId, false);
        setLineDirty(setFormDirtyLineIds, createdId, false);
      } else {
        router.refresh();
      }
      setNewLine(emptyLine);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveLine(line: Line, updates: typeof emptyLine, resolvedIngredientName?: string | null) {
    setError(null);
    setLineBusy(setSavingLineIds, line.id, true);
    try {
      const validatedId = updates.validated_ingredient_id || null;
      const response = await fetch(`/api/cheffing/procurement/lines/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_description: updates.raw_description,
          raw_quantity: updates.raw_quantity ? Number(updates.raw_quantity) : null,
          raw_unit: updates.raw_unit,
          validated_unit: updates.validated_unit || null,
          raw_unit_price: updates.raw_unit_price ? Number(updates.raw_unit_price) : null,
          raw_line_total: updates.raw_line_total ? Number(updates.raw_line_total) : null,
          validated_ingredient_id: validatedId,
          line_status: validatedId ? 'resolved' : 'unresolved',
          user_note: updates.user_note,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo actualizar la línea');
      }
      const nextIngredientId = validatedId;
      const nextIngredientName =
        nextIngredientId
          ? resolvedIngredientName ?? localIngredients.find((ingredient) => ingredient.id === nextIngredientId)?.name ?? null
          : null;
      setLocalLines((current) =>
        sortLinesByNumberAsc(
          current.map((entry) =>
            entry.id === line.id
              ? {
                  ...entry,
                  raw_description: updates.raw_description,
                  raw_quantity: updates.raw_quantity ? Number(updates.raw_quantity) : null,
                  raw_unit: updates.raw_unit || null,
                  validated_unit: (updates.validated_unit || null) as ProcurementCanonicalUnit | null,
                  raw_unit_price: updates.raw_unit_price ? Number(updates.raw_unit_price) : null,
                  raw_line_total: updates.raw_line_total ? Number(updates.raw_line_total) : null,
                  validated_ingredient_id: nextIngredientId,
                  line_status: nextIngredientId ? 'resolved' : 'unresolved',
                  user_note: updates.user_note || null,
                  validated_ingredient: nextIngredientId ? { name: nextIngredientName } : null,
                }
              : entry,
          ),
        ),
      );
      setLineDirty(setModelDirtyLineIds, line.id, false);
      setLineDirty(setFormDirtyLineIds, line.id, false);
      setEditingLineId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLineBusy(setSavingLineIds, line.id, false);
    }
  }

  async function deleteLine(lineId: string) {
    setError(null);
    setLineBusy(setDeletingLineIds, lineId, true);
    try {
      const response = await fetch(`/api/cheffing/procurement/lines/${lineId}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo borrar la línea');
      }
      setLocalLines((current) => sortLinesByNumberAsc(current.filter((line) => line.id !== lineId)));
      setLineDirty(setModelDirtyLineIds, lineId, false);
      setLineDirty(setFormDirtyLineIds, lineId, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLineBusy(setDeletingLineIds, lineId, false);
    }
  }

  function resolveLineSuggestedIngredientId(line: Line): string | null {
    return line.suggested_ingredient_id ?? lineSuggestionHintByLineNumber.get(line.line_number)?.suggestedIngredientId ?? null;
  }

  function acceptSuggestedLine(line: Line, suggestedIngredientId?: string | null) {
    const resolvedSuggestedIngredientId = suggestedIngredientId ?? resolveLineSuggestedIngredientId(line);
    if (!resolvedSuggestedIngredientId) return;
    const suggestedCanonicalUnit = normalizeProcurementCanonicalUnit(line.validated_unit ?? line.normalized_unit_code ?? line.interpreted_unit ?? '');
    const nextIngredientName = localIngredients.find((ingredient) => ingredient.id === resolvedSuggestedIngredientId)?.name ?? null;
    setLocalLines((current) =>
      sortLinesByNumberAsc(
        current.map((entry) =>
          entry.id === line.id
            ? {
                ...entry,
                validated_ingredient_id: resolvedSuggestedIngredientId,
                line_status: 'resolved',
                validated_unit: typeof suggestedCanonicalUnit === 'string' ? suggestedCanonicalUnit : entry.validated_unit,
                validated_ingredient: { name: nextIngredientName },
              }
            : entry,
        ),
      ),
    );
    setLineDirty(setModelDirtyLineIds, line.id, true);
  }

  async function createIngredientForLine() {
    if (!isCreatingIngredient) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const parsedPackQty = Number(isCreatingIngredient.packQty || '1');
      const parsedPrice = Number(isCreatingIngredient.price || '0');
      if (!isCreatingIngredient.name.trim()) {
        throw new Error('El nombre del ingrediente es obligatorio.');
      }
      if (!Number.isFinite(parsedPackQty) || parsedPackQty <= 0) {
        throw new Error('La cantidad de pack debe ser mayor que 0.');
      }
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        throw new Error('El precio debe ser 0 o mayor.');
      }
      const payload = {
        name: isCreatingIngredient.name.trim(),
        purchase_unit_code: isCreatingIngredient.unitCode || 'ud',
        purchase_pack_qty: parsedPackQty,
        purchase_price: parsedPrice,
        waste_pct: 0,
      };
      const createResponse = await fetch('/api/cheffing/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const createResult = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || typeof createResult?.id !== 'string') {
        throw new Error(createResult?.error ?? 'No se pudo crear el ingrediente');
      }
      const targetLine = localLinesRef.current.find((line) => line.id === isCreatingIngredient.lineId);
      if (!targetLine) throw new Error('No se encontró la línea para vincular el ingrediente');
      const createdIngredientName = payload.name;
      setLocalIngredients((current) => {
        const exists = current.some((ingredient) => ingredient.id === createResult.id);
        if (exists) return current;
        return [...current, { id: createResult.id, name: createdIngredientName }].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      });
      await saveLine(targetLine, {
        ...isCreatingIngredient.lineSnapshot,
        validated_ingredient_id: createResult.id,
      }, createdIngredientName);
      setIsCreatingIngredient(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function applyDocument() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/apply`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo aplicar el documento');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function discardDocument() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/discard`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo descartar el documento');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function recoverDocument() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/recover`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo recuperar el documento');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteDocumentPermanently() {
    const confirmed = window.confirm('¿Seguro que quieres eliminar este documento?\n\nEsta acción no se puede deshacer.');
    if (!confirmed) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo eliminar el documento');
      }
      router.push('/cheffing/compras');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function processOcr() {
    setError(null);
    setOcrMessage(null);
    setIsProcessingOcr(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_override_lines: false }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? 'No se pudo procesar OCR');
      }

      const insertedLines = typeof payload?.inserted_lines === 'number' ? payload.inserted_lines : 0;
      const cleanupStatus = typeof payload?.cleanup_meta?.status === 'string' ? payload.cleanup_meta.status : null;
      setOcrMessage({
        kind: 'success',
        text:
          cleanupStatus === 'failed'
            ? `OCR Azure procesado. OpenAI cleanup falló (degradación aplicada). Líneas sugeridas creadas: ${insertedLines}.`
            : `OCR Azure procesado${cleanupStatus === 'applied' ? ' + OpenAI cleanup aplicado' : ''}. Líneas sugeridas creadas: ${insertedLines}.`,
      });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido al procesar OCR';
      setError(message);
      setOcrMessage({ kind: 'error', text: message });
    } finally {
      setIsProcessingOcr(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Ficha operativa</p>
            <h2 className="text-xl font-semibold text-white">Documento de compra</h2>
            <p className="text-sm text-slate-400">Misma pantalla para carga manual, OCR Azure + cleanup OpenAI y consulta en solo lectura.</p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200">
            Estado: {documentStatusLabel(document.status)}
          </div>
        </div>


        {possibleDocumentDuplicate?.status === 'possible_duplicate' ? (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100">
            <p className="text-xs font-semibold uppercase tracking-wide">Posible duplicado documental</p>
            <p className="mt-1 text-sm">
              Señal prudente activa (score {possibleDocumentDuplicate.score}). Revisa si este borrador ya existe antes de aplicar.
            </p>
            <p className="mt-1 text-xs text-amber-200/90">
              Motivos: {possibleDocumentDuplicate.reasons.length > 0 ? possibleDocumentDuplicate.reasons.join(', ') : 'sin detalle'} · coincidencias: {possibleDocumentDuplicate.candidateDocumentIds.join(', ') || '—'}.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 xl:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Proveedor confirmado</p>
            <p className="mt-1 text-base font-semibold text-white">{persistedSupplierLabel ?? 'Sin proveedor asignado en DB'}</p>
            {hasPendingSupplierSelection ? (
              <p className="mt-2 text-xs text-sky-300">
                Selección actual pendiente de guardar: {selectedSupplierLabel ?? 'Proveedor sugerido'}.
              </p>
            ) : null}
            {!document.supplier_id ? <p className="mt-2 text-xs text-amber-300">⚠ Guarda cabecera para confirmar proveedor antes de aplicar.</p> : null}
          </div>
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-3 xl:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Proveedor detectado (base Azure + cleanup OpenAI)</p>
            {detectedSupplier ? (
              <div className="mt-1 space-y-1 text-sm text-slate-200">
                <p>{detectedSupplier.name ?? 'Sin nombre detectado'}</p>
                <p className="text-xs text-slate-400">NIF/CIF: {detectedSupplier.taxId ?? '—'} · Email: {detectedSupplier.email ?? '—'} · Tel: {detectedSupplier.phone ?? '—'}</p>
                <p className="text-xs text-slate-400">Match sugerido: {detectedSupplier.matchHint ?? 'Sugerencia OCR sin confirmación automática'}</p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-400">Sin datos detectados todavía.</p>
            )}
            {cleanupMeta ? (
              <p className={`mt-2 text-xs ${cleanupMeta.status === 'failed' ? 'text-amber-300' : 'text-slate-400'}`}>
                Cleanup OpenAI: {cleanupMeta.status ?? 'sin estado'}
                {cleanupMeta.model ? ` · modelo: ${cleanupMeta.model}` : ''}
                {cleanupMeta.affectedLines !== null ? ` · líneas afectadas: ${cleanupMeta.affectedLines}` : ''}
                {cleanupMeta.warning ? ` · aviso: ${cleanupMeta.warning}` : ''}
              </p>
            ) : null}
          </div>
          <HeaderDatum label="Tipo" value={documentKindLabel(header.document_kind)} />
          <HeaderDatum label="Número" value={header.document_number || '—'} />
          <HeaderDatum label="Fecha" value={header.document_date} />
          <HeaderDatum label="Subtotal líneas" value={formatCurrency(totalsInsight.lineSubtotal)} />
          <HeaderDatum label="Subtotal cabecera detectado" value={totalsInsight.headerSubtotalDetected !== null ? formatCurrency(totalsInsight.headerSubtotalDetected) : '—'} />
          <HeaderDatum label="Delta líneas vs cabecera" value={totalsInsight.deltaLinesVsHeaderSubtotal === null ? '—' : formatCurrency(totalsInsight.deltaLinesVsHeaderSubtotal)} />
          <HeaderDatum label="IVA detectado" value={totalsInsight.vatDetected !== null ? formatCurrency(totalsInsight.vatDetected) : '—'} />
          <HeaderDatum label="IVA estimado (diferencia)" value={totalsInsight.vatEstimatedFromDelta !== null && totalsInsight.vatEstimatedFromDelta > 0 ? formatCurrency(totalsInsight.vatEstimatedFromDelta) : '—'} />
          <HeaderDatum label="Total declarado" value={header.declared_total ? formatCurrency(Number(header.declared_total)) : '—'} />
          <HeaderDatum label="Líneas" value={String(linesCount)} />
          <HeaderDatum
            label={totalsInsight.vatLikelyExplainsDelta ? 'Delta real (sin IVA)' : 'Diferencia (declarado - calculado)'}
            value={totalsInsight.grossDeltaReal === null ? '—' : formatCurrency(totalsInsight.grossDeltaReal)}
          />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Cabecera del documento</h3>
              {isDraft ? (
                <button disabled={isSubmitting} type="button" onClick={saveHeader} className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200">
                  Guardar cabecera
                </button>
              ) : (
                <span className="text-xs text-slate-500">Solo lectura</span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Proveedor confirmado</label>
                <select
                  disabled={!isDraft}
                  value={header.supplier_id}
                  onChange={(event) => {
                    const supplierId = event.target.value;
                    const prefill = resolveSupplierContactPrefill(supplierId);
                    setHeader((current) => ({
                      ...current,
                      supplier_id: supplierId,
                      supplier_tax_id: prefill.tax_id,
                      supplier_email: prefill.email,
                      supplier_phone: prefill.phone,
                    }));
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                >
                  <option value="">Sense proveïdor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.trade_name}
                    </option>
                  ))}
                </select>
                {isDraft && suggestedExistingSupplier ? (
                  <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-2 text-xs text-sky-100">
                    <p className="font-semibold">
                      Sugerencia proveedor existente: {suggestedExistingSupplier.tradeName} · score {suggestedExistingSupplier.scoreHint}
                    </p>
                    {suggestedExistingSupplier.detectedNameNormalized || suggestedExistingSupplier.supplierNameNormalized ? (
                      <p className="mt-1 text-sky-200/90">
                        Nombre OCR normalizado: <code>{suggestedExistingSupplier.detectedNameNormalized ?? '—'}</code> ·
                        candidato normalizado: <code>{suggestedExistingSupplier.supplierNameNormalized ?? '—'}</code>
                      </p>
                    ) : null}
                    <p className="text-sky-200/90">
                      {suggestedExistingSupplier.shouldAutoSelect
                        ? 'Match fuerte y dominante (preseleccionado en cabecera, pendiente de guardar).'
                        : 'Match no suficientemente fuerte/dominante: requiere selección manual.'}
                    </p>
                    {suggestedExistingSupplier.reasons.length > 0 ? (
                      <p className="mt-1 text-sky-200/90">Motivos: {suggestedExistingSupplier.reasons.join(', ')}</p>
                    ) : null}
                    {suggestedExistingSupplier.matchTrace.length > 0 ? (
                      <p className="mt-1 text-sky-200/90">Trazabilidad: {suggestedExistingSupplier.matchTrace.join(' · ')}</p>
                    ) : null}
                    {header.supplier_id !== suggestedExistingSupplier.supplierId ? (
                      <button
                        type="button"
                        onClick={() => setHeader((current) => ({ ...current, supplier_id: suggestedExistingSupplier.supplierId }))}
                        className="mt-2 rounded-full border border-sky-400/60 px-3 py-1 text-[11px] font-semibold text-sky-100"
                      >
                        Asignar sugerencia
                      </button>
                    ) : null}
                    {suggestedExistingSupplier.shouldAutoSelect ? (
                      <button
                        type="button"
                        onClick={confirmSuggestedSupplierAndSave}
                        disabled={isSubmitting}
                        className="mt-2 ml-2 rounded-full border border-emerald-400/60 px-3 py-1 text-[11px] font-semibold text-emerald-100"
                      >
                        Confirmar proveedor sugerido y guardar cabecera
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {supplierEnrichment ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100">
                    <p className="font-semibold">Estado enriquecimiento proveedor: {supplierEnrichment.status}</p>
                    <p className="mt-1">{supplierEnrichment.summary}</p>
                    {supplierEnrichment.autoFilled.length > 0 ? (
                      <p className="mt-1">Campos añadidos: {supplierEnrichment.autoFilled.map((entry) => `${entry.field}=${entry.value}`).join(' · ')}</p>
                    ) : (
                      <p className="mt-1">{supplierEnrichmentStatusMessage(supplierEnrichment.status)}</p>
                    )}
                    {supplierEnrichment.conflicts.length > 0 ? (
                      <p className="mt-1">
                        Conflictos detectados (sin sobreescritura): {supplierEnrichment.conflicts.map((entry) => `${entry.field} DB:${entry.existing_value} ↔ OCR:${entry.detected_value}`).join(' · ')}.
                      </p>
                    ) : null}
                    <p className="mt-1">
                      Intento de guardado: {supplierEnrichment.updateAttempt.attempted ? (supplierEnrichment.updateAttempt.applied ? 'aplicado' : 'fallido') : 'no intentado'}.
                    </p>
                    {supplierEnrichment.updateAttempt.warning ? <p className="mt-1 text-rose-200">Aviso actualización proveedor: {supplierEnrichment.updateAttempt.warning}</p> : null}
                  </div>
                ) : null}
                <div className="mt-2 grid gap-2">
                  <input
                    disabled={!isDraft}
                    value={header.supplier_tax_id}
                    onChange={(event) => setHeader({ ...header, supplier_tax_id: event.target.value })}
                    placeholder="CIF/NIF proveedor (cabecera)"
                    className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                  />
                  <p className="text-[11px] text-slate-400">Sugerido OCR: {detectedSupplier?.taxId ?? '—'}.</p>
                  <input
                    disabled={!isDraft}
                    value={header.supplier_email}
                    onChange={(event) => setHeader({ ...header, supplier_email: event.target.value })}
                    placeholder="Email proveedor (cabecera)"
                    className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                  />
                  <p className="text-[11px] text-slate-400">Sugerido OCR: {detectedSupplier?.email ?? '—'}.</p>
                  <input
                    disabled={!isDraft}
                    value={header.supplier_phone}
                    onChange={(event) => setHeader({ ...header, supplier_phone: event.target.value })}
                    placeholder="Teléfono proveedor (cabecera)"
                    className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                  />
                  <p className="text-[11px] text-slate-400">Sugerido OCR: {detectedSupplier?.phone ?? '—'}.</p>
                </div>
                {isDraft ? (
                  <div className="space-y-2">
                    {!isCreatingSupplier && !suggestedExistingSupplier?.shouldAutoSelect ? (
                      <button
                        type="button"
                        onClick={openNewSupplierForm}
                        disabled={hasUnsavedHeaderChanges}
                        title={createSupplierBlockedReason ?? undefined}
                        className="text-xs font-semibold text-emerald-300 underline decoration-dotted underline-offset-4 disabled:cursor-not-allowed disabled:text-slate-500"
                      >
                        Crear nuevo proveedor
                      </button>
                    ) : null}
                    {!isCreatingSupplier && suggestedExistingSupplier?.shouldAutoSelect ? (
                      <p className="text-xs text-amber-300">Bloque “crear proveedor” oculto por match fuerte para evitar duplicados.</p>
                    ) : null}
                    {isCreatingSupplier ? (
                      <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nuevo proveedor</p>
                        <div className="grid gap-2">
                          <input
                            value={newSupplierForm.trade_name}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, trade_name: event.target.value }))}
                            placeholder="Nombre comercial *"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                          <input
                            value={newSupplierForm.legal_name}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, legal_name: event.target.value }))}
                            placeholder="Razón social"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                          <input
                            value={newSupplierForm.tax_id}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, tax_id: event.target.value }))}
                            placeholder="NIF/CIF"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                          <input
                            value={newSupplierForm.phone}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, phone: event.target.value }))}
                            placeholder="Teléfono"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                          <input
                            value={newSupplierForm.email}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, email: event.target.value }))}
                            placeholder="Email"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={createAndAssignSupplier} disabled={isSubmitting} className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-200">
                            Guardar y asignar
                          </button>
                          <button type="button" onClick={cancelNewSupplierForm} disabled={isSubmitting} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {createSupplierBlockedReason ? (
                      <p className="text-xs text-amber-300">{createSupplierBlockedReason}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Tipo de documento</label>
                <select disabled={!isDraft} value={header.document_kind} onChange={(event) => setHeader({ ...header, document_kind: event.target.value as ProcurementDocumentKind })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white">
                  <option value="invoice">Factura</option>
                  <option value="delivery_note">Albarán</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="space-y-1">
                <input disabled={!isDraft} value={header.document_number} onChange={(event) => setHeader({ ...header, document_number: event.target.value })} placeholder="Número de documento" className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
                <p className="text-[11px] text-slate-400">DB: {document.document_number ?? 'vacío'} · Sugerido OCR: {detectedDocument.documentNumber || '—'}.</p>
              </div>
              <div className="space-y-1">
                <input disabled={!isDraft} type="date" value={header.document_date} onChange={(event) => setHeader({ ...header, document_date: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
                <p className="text-[11px] text-slate-400">DB: {document.document_date || 'vacío'} · Sugerido OCR: {detectedDocument.documentDate || '—'}.</p>
              </div>
              <div className="space-y-1">
                <input disabled={!isDraft} type="number" step="0.01" min="0" value={header.declared_total} onChange={(event) => setHeader({ ...header, declared_total: event.target.value })} placeholder="Total declarado" className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
                <p className="text-[11px] text-slate-400">DB: {document.declared_total !== null ? formatCurrency(document.declared_total) : 'vacío'} · Sugerido OCR: {detectedDocument.declaredTotal ? formatCurrency(Number(detectedDocument.declaredTotal)) : '—'}.</p>
              </div>
              <textarea disabled={!isDraft} value={header.validation_notes} onChange={(event) => setHeader({ ...header, validation_notes: event.target.value })} placeholder="Notas internas / revisión" className="min-h-24 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white md:col-span-2" />
            </div>
          </section>

          {isDraft ? (
            <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Líneas del documento</h3>
                <button type="button" onClick={addLine} disabled={isSubmitting} className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200">
                  Añadir línea
                </button>
              </div>
              <LineForm value={newLine} onChange={setNewLine} ingredients={localIngredients} />
            </section>
          ) : null}

          <section className="overflow-x-auto rounded-2xl border border-slate-800/70">
            <table className="w-full min-w-[1200px] text-left text-sm text-slate-200">
              <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Descripción original (raw Azure)</th>
                  <th className="px-4 py-3">Ingrediente vinculado</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Unidad (canónica)</th>
                  <th className="px-4 py-3">Precio unitario</th>
                  <th className="px-4 py-3">Total línea</th>
                  <th className="px-4 py-3">Warning sistema</th>
                  <th className="px-4 py-3">Nota manual</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const resolvedSuggestedIngredientId = resolveLineSuggestedIngredientId(line);
                  return (
                  <EditableLineRow
                    key={line.id}
                    line={line}
                    ingredients={localIngredients}
                    suggestedIngredientId={resolvedSuggestedIngredientId}
                    suggestedHint={lineSuggestionHintByLineNumber.get(line.line_number) ?? null}
                    isDraft={isDraft}
                    isEditing={editingLineId === line.id}
                    onEdit={() => setEditingLineId(line.id)}
                    onCancel={() => setEditingLineId(null)}
                    onSave={saveLine}
                    onDelete={deleteLine}
                    onAcceptSuggestion={acceptSuggestedLine}
                    isDirty={modelDirtyLineIds.has(line.id) || formDirtyLineIds.has(line.id)}
                    onFormDirtyChange={handleFormDirtyChange}
                    onCreateIngredient={(targetLine, lineSnapshot) =>
                      setIsCreatingIngredient({
                        lineId: targetLine.id,
                        name: targetLine.interpreted_description?.trim() || targetLine.raw_description,
                        unitCode: lineSnapshot.validated_unit || targetLine.normalized_unit_code || 'ud',
                        packQty: '1',
                        price: targetLine.raw_unit_price?.toString() ?? '0',
                        lineSnapshot,
                      })
                    }
                    duplicateHint={duplicateHintByLineNumber.get(line.line_number) ?? null}
                    isSaving={savingLineIds.has(line.id)}
                    isDeleting={deletingLineIds.has(line.id)}
                    isCreatingIngredient={isCreatingIngredient?.lineId === line.id}
                  />
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-white">Documento original</h3>
            <p className="text-xs text-slate-400">Sube imagen o PDF para revisión lado a lado con cabecera y líneas.</p>

            {document.storage_path ? (
              <p className="text-xs text-slate-500 break-all">{document.storage_path}</p>
            ) : (
              <p className="text-xs text-slate-500">Aún no hay archivo asociado.</p>
            )}

            {isDraft ? (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => setFileToUpload(event.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-300 file:mr-4 file:rounded-full file:border file:border-slate-700 file:bg-slate-900 file:px-3 file:py-1 file:text-slate-200"
                />
                <p className="text-[11px] text-slate-500">Tipos permitidos: {PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES.join(', ')}.</p>
                <button
                  type="button"
                  disabled={!fileToUpload || isSubmitting || isProcessingOcr}
                  onClick={uploadSourceFile}
                  className="w-full rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                >
                  {document.storage_path ? 'Reemplazar archivo original' : 'Subir archivo original'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Documento en solo lectura: no se permite reemplazar archivo fuera de draft.</p>
            )}

            {isDraft && document.storage_path ? (
              <button
                type="button"
                onClick={processOcr}
                disabled={isSubmitting || isProcessingOcr || linesCount > 0}
                className="w-full rounded-full border border-sky-400/60 px-4 py-2 text-sm font-semibold text-sky-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                title={linesCount > 0 ? 'Bloqueado: el documento ya tiene líneas y no se permite re-ejecutar OCR en esta fase.' : undefined}
              >
                {isProcessingOcr ? 'Procesando OCR…' : 'Procesar OCR Azure + cleanup OpenAI'}
              </button>
            ) : null}
            {isDraft && document.storage_path && linesCount > 0 ? (
              <p className="text-xs text-amber-300">
                OCR bloqueado en re-ejecución: este documento ya tiene líneas y no se sobrescribe trabajo manual sin confirmación fuerte.
              </p>
            ) : null}
            {ocrMessage ? (
              <p className={ocrMessage.kind === 'success' ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>{ocrMessage.text}</p>
            ) : null}

            {sourceFileUrl && sourceFileKind === 'image' ? (
              <a href={sourceFileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-700">
                <img src={sourceFileUrl} alt="Documento original" className="max-h-[26rem] w-full object-contain bg-slate-950" />
              </a>
            ) : null}

            {sourceFileUrl && sourceFileKind === 'pdf' ? (
              <div className="space-y-2">
                <iframe src={sourceFileUrl} title="Documento original PDF" className="h-[26rem] w-full rounded-lg border border-slate-700 bg-slate-950" />
                <a href={sourceFileUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 underline">Abrir PDF en pestaña nueva</a>
              </div>
            ) : null}

            {sourceFileUrl && sourceFileKind === 'unknown' ? (
              <a href={sourceFileUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 underline">Abrir archivo original</a>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-white">Resumen y readiness</h3>
            <dl className="space-y-2 text-sm">
              <SummaryRow label="Líneas" value={String(linesCount)} />
              <SummaryRow label="Subtotal líneas" value={formatCurrency(totalsInsight.lineSubtotal)} />
              <SummaryRow label="Subtotal cabecera detectado (OCR)" value={totalsInsight.headerSubtotalDetected !== null ? formatCurrency(totalsInsight.headerSubtotalDetected) : '—'} />
              <SummaryRow label="Delta líneas vs cabecera" value={totalsInsight.deltaLinesVsHeaderSubtotal === null ? '—' : formatCurrency(totalsInsight.deltaLinesVsHeaderSubtotal)} />
              <SummaryRow label="IVA detectado (si aplica)" value={totalsInsight.vatDetected !== null ? formatCurrency(totalsInsight.vatDetected) : '—'} />
              <SummaryRow
                label="IVA estimado por diferencia"
                value={totalsInsight.vatEstimatedFromDelta !== null && totalsInsight.vatEstimatedFromDelta > 0 ? formatCurrency(totalsInsight.vatEstimatedFromDelta) : '—'}
              />
              <SummaryRow label="Total declarado en documento" value={header.declared_total ? formatCurrency(Number(header.declared_total)) : '—'} />
              <SummaryRow
                label={totalsInsight.vatLikelyExplainsDelta ? 'Delta real bruto (declarado - (subtotal líneas + IVA))' : 'Delta real bruto (declarado - subtotal líneas)'}
                value={totalsInsight.grossDeltaReal === null ? '—' : formatCurrency(totalsInsight.grossDeltaReal)}
              />
            </dl>
            <p
              className={`rounded-lg p-2 text-xs ${
                totalsInsight.grossDeltaReal !== null && Math.abs(totalsInsight.grossDeltaReal) >= 0.01
                  ? 'border border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              {totalsInsight.vatLikelyExplainsDelta
                ? 'El delta declarado-calculado parece corresponder al IVA detectado; no se marca como discrepancia real de OCR.'
                : totalsInsight.vatDetected === null && totalsInsight.vatEstimatedFromDelta !== null && totalsInsight.vatEstimatedFromDelta > 0
                  ? 'La diferencia podría corresponder a IVA, pero no hay señal fiscal OCR suficientemente fiable para confirmarlo.'
                : totalsInsight.grossDeltaReal !== null && Math.abs(totalsInsight.grossDeltaReal) >= 0.01
                  ? 'Hay delta real relevante entre declarado y subtotal de líneas. Revisa líneas no imputables o importes OCR.'
                  : 'Declarado y calculado están alineados (sin delta real relevante).'}
            </p>

            {readinessReasons.length > 0 ? (
              <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                <p className="font-semibold">Bloqueos para aplicar</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {readinessReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Documento listo para aplicar. Se usará <code>raw_unit_price</code> como coste manual V1 por línea.
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-white">Acciones</h3>

            {document.status === 'draft' ? (
              <button
                type="button"
                onClick={applyDocument}
                disabled={!canApply || isSubmitting || isProcessingOcr}
                className="w-full rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                Aplicar documento
              </button>
            ) : null}

            {document.status === 'draft' ? (
              <button type="button" onClick={discardDocument} disabled={isSubmitting || isProcessingOcr} className="w-full rounded-full border border-amber-500/60 px-4 py-2 text-sm text-amber-200">
                Descartar documento
              </button>
            ) : null}

            {document.status === 'draft' ? (
              <button type="button" onClick={deleteDocumentPermanently} disabled={isSubmitting || isProcessingOcr} className="w-full rounded-full border border-rose-500/60 px-4 py-2 text-sm text-rose-200">
                Eliminar definitivo
              </button>
            ) : null}

            {document.status === 'discarded' ? (
              <>
                <button type="button" onClick={recoverDocument} disabled={isSubmitting} className="w-full rounded-full border border-emerald-500/50 px-4 py-2 text-sm text-emerald-200">
                  Recuperar a borrador
                </button>
                <button type="button" onClick={deleteDocumentPermanently} disabled={isSubmitting} className="w-full rounded-full border border-rose-500/60 px-4 py-2 text-sm text-rose-200">
                  Eliminar definitivo
                </button>
              </>
            ) : null}

            {document.status === 'applied' ? <p className="text-xs text-emerald-300">Documento aplicado en solo lectura.</p> : null}
            {document.status === 'discarded' ? <p className="text-xs text-slate-300">Documento descartado: se puede recuperar o eliminar de forma permanente.</p> : null}
          </section>

          {error ? <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p> : null}
        </aside>
      </div>
      {isCreatingIngredient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h4 className="text-sm font-semibold text-white">Crear ingrediente desde línea OCR</h4>
            <input value={isCreatingIngredient.name} onChange={(event) => setIsCreatingIngredient((current) => (current ? { ...current, name: event.target.value } : current))} placeholder="Nombre" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
            <div className="grid gap-2 md:grid-cols-3">
              <select value={isCreatingIngredient.unitCode} onChange={(event) => setIsCreatingIngredient((current) => (current ? { ...current, unitCode: event.target.value } : current))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                {units.length === 0 ? <option value="ud">ud</option> : null}
                {units.map((unit) => <option key={unit.code} value={unit.code}>{unit.code} · {unit.name}</option>)}
              </select>
              <input value={isCreatingIngredient.packQty} onChange={(event) => setIsCreatingIngredient((current) => (current ? { ...current, packQty: event.target.value } : current))} type="number" step="0.001" min="0.001" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Pack qty" />
              <input value={isCreatingIngredient.price} onChange={(event) => setIsCreatingIngredient((current) => (current ? { ...current, price: event.target.value } : current))} type="number" step="0.0001" min="0" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Precio" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreatingIngredient(null)} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">Cancelar</button>
              <button type="button" onClick={createIngredientForLine} disabled={isSubmitting} className="rounded-full border border-emerald-500/70 px-3 py-1 text-xs text-emerald-200">Crear y vincular</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-2 last:border-none last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}

function LineForm({ value, onChange, ingredients }: { value: typeof emptyLine; onChange: (value: typeof emptyLine) => void; ingredients: Ingredient[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <input value={value.raw_description} onChange={(event) => onChange({ ...value, raw_description: event.target.value })} placeholder="Descripción original" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white md:col-span-2" />
      <SearchableIngredientSelect value={value.validated_ingredient_id} ingredients={ingredients} onChange={(nextId) => onChange({ ...value, validated_ingredient_id: nextId })} placeholder="Ingrediente sin validar" />
      <input type="number" step="0.001" value={value.raw_quantity} onChange={(event) => onChange({ ...value, raw_quantity: event.target.value })} placeholder="Cantidad" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input value={value.raw_unit} onChange={(event) => onChange({ ...value, raw_unit: event.target.value })} placeholder="Unidad original (traza)" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <select value={value.validated_unit} onChange={(event) => onChange({ ...value, validated_unit: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white">
        <option value="">Unidad canónica sin validar</option>
        {PROCUREMENT_CANONICAL_UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
      <input type="number" step="0.0001" value={value.raw_unit_price} onChange={(event) => onChange({ ...value, raw_unit_price: event.target.value })} placeholder="Precio unitario" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input type="number" step="0.0001" value={value.raw_line_total} onChange={(event) => onChange({ ...value, raw_line_total: event.target.value })} placeholder="Total línea" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input value={value.user_note} onChange={(event) => onChange({ ...value, user_note: event.target.value })} placeholder="Nota manual (opcional)" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white md:col-span-4" />
    </div>
  );
}

function EditableLineRow({ line, ingredients, suggestedIngredientId, suggestedHint, isDraft, isEditing, isDirty, onEdit, onCancel, onSave, onDelete, onAcceptSuggestion, onCreateIngredient, onFormDirtyChange, duplicateHint, isSaving, isDeleting, isCreatingIngredient }: { line: Line; ingredients: Ingredient[]; suggestedIngredientId: string | null; suggestedHint: LineSuggestionHint | null; isDraft: boolean; isEditing: boolean; isDirty: boolean; onEdit: () => void; onCancel: () => void; onSave: (line: Line, updates: typeof emptyLine) => void; onDelete: (lineId: string) => void; onAcceptSuggestion: (line: Line, suggestedIngredientId?: string | null) => void; onCreateIngredient: (line: Line, snapshot: typeof emptyLine) => void; onFormDirtyChange: (lineId: string, dirty: boolean) => void; duplicateHint: DuplicateHint | null; isSaving: boolean; isDeleting: boolean; isCreatingIngredient: boolean }) {
  const ingredientName = useMemo(() => {
    const source = line.validated_ingredient;
    return Array.isArray(source) ? source[0]?.name : source?.name;
  }, [line.validated_ingredient]);
  const suggestedIngredientName = useMemo(
    () => ingredients.find((ingredient) => ingredient.id === suggestedIngredientId)?.name ?? null,
    [ingredients, suggestedIngredientId],
  );
  const [form, setForm] = useState(lineToFormSnapshot(line));
  const persistedSnapshot = lineToFormSnapshot(line);
  const isFormDirty = hasLineSnapshotChanges(form, persistedSnapshot);
  const pendingIngredientName = useMemo(
    () => ingredients.find((ingredient) => ingredient.id === form.validated_ingredient_id)?.name ?? null,
    [form.validated_ingredient_id, ingredients],
  );
  const suggestedSummaryLabel = suggestedHint?.suggestedIngredientName ?? suggestedIngredientName;
  const suggestedIsAlreadySelected =
    Boolean(suggestedIngredientId) &&
    (line.validated_ingredient_id === suggestedIngredientId || form.validated_ingredient_id === suggestedIngredientId);
  const matchingStateLabel = suggestedIngredientId
    ? suggestedHint?.hasNoStrongMatch
      ? 'Match OCR débil: requiere validación manual.'
      : suggestedHint?.hasAmbiguousTopMatch
        ? 'Match OCR ambiguo: revisa antes de confirmar.'
        : 'Sugerencia OCR disponible.'
    : 'Sin match OCR fiable: seleccionar manualmente.';

  useEffect(() => {
    if (isEditing && isFormDirty) return;
    setForm(lineToFormSnapshot(line));
  }, [isEditing, isFormDirty, line]);

  useEffect(() => {
    onFormDirtyChange(line.id, isFormDirty);
  }, [isFormDirty, line.id, onFormDirtyChange]);
  const isRowBusy = isSaving || isDeleting || isCreatingIngredient;

  return (
    <tr className="border-t border-slate-800/60">
      <td className="px-4 py-3">{line.line_number}</td>
      <td className="px-4 py-3">{isEditing ? <input value={form.raw_description} onChange={(event) => setForm({ ...form, raw_description: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : line.raw_description}</td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <p>{ingredientName ?? '—'}</p>
          {isDirty ? <p className="text-[11px] font-medium text-amber-300">Cambios pendientes</p> : null}
          {suggestedSummaryLabel ? (
            <p className="text-xs text-sky-300">
              Sugerido: {suggestedSummaryLabel}
              {typeof suggestedHint?.scoreHint === 'number' ? ` · score ${suggestedHint.scoreHint.toFixed(0)}` : ''}
            </p>
          ) : null}
          <p className="text-[11px] text-slate-400">{matchingStateLabel}</p>
          {suggestedHint?.reasonLabel ? <p className="text-[11px] text-slate-500">Motivo: {suggestedHint.reasonLabel}</p> : null}
          {suggestedHint?.isManualSuggestionCandidate ? <p className="text-[11px] text-emerald-300">Sugerencia manual útil (1 clic)</p> : null}
          {suggestedHint?.isAutoHighConfidence ? <p className="text-[11px] text-sky-300">Match alto (pipeline)</p> : null}
          {suggestedHint?.hasAmbiguousTopMatch ? (
            <p className="text-[11px] text-amber-300">Ambigüedad: hay más de un candidato fuerte para esta línea.</p>
          ) : null}
          {suggestedIngredientId && suggestedHint?.hasNoStrongMatch ? (
            <p className="text-[11px] text-amber-300">Match débil: sugerencia útil pero no suficientemente fiable.</p>
          ) : null}
          {!suggestedIngredientId ? <p className="text-[11px] text-amber-300">Sin sugerencia directa: busca manualmente o crea ingrediente.</p> : null}
          {isFormDirty && pendingIngredientName && pendingIngredientName !== ingredientName ? (
            <p className="text-[11px] text-amber-300">Selección pendiente: {pendingIngredientName}</p>
          ) : null}
          {isDraft ? (
            <>
              {suggestedIngredientId ? (
                <button
                  type="button"
                  disabled={suggestedIsAlreadySelected || isRowBusy}
                  onClick={() => {
                    if (!suggestedIngredientId) return;
                    if (isEditing) {
                      const suggestedCanonicalUnit = normalizeProcurementCanonicalUnit(line.validated_unit ?? line.normalized_unit_code ?? line.interpreted_unit ?? '');
                      setForm((current) => ({
                        ...current,
                        validated_ingredient_id: suggestedIngredientId,
                        validated_unit:
                          current.validated_unit ||
                          (typeof suggestedCanonicalUnit === 'string' ? suggestedCanonicalUnit : ''),
                      }));
                      return;
                    }
                    onAcceptSuggestion(line, suggestedIngredientId);
                  }}
                  className="rounded-full border border-emerald-500/60 px-2 py-0.5 text-[11px] text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                >
                  {suggestedIsAlreadySelected ? 'Sugerencia ya aplicada' : '✓ Aceptar sugerencia'}
                </button>
              ) : null}
              <SearchableIngredientSelect
                value={form.validated_ingredient_id}
                ingredients={ingredients}
                onChange={(nextId) => setForm({ ...form, validated_ingredient_id: nextId })}
                placeholder="Sin validar"
              />
              <button type="button" onClick={() => onCreateIngredient(line, form)} disabled={isRowBusy} className="rounded-full border border-sky-500/60 px-2 py-0.5 text-[11px] text-sky-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500">
                {isCreatingIngredient ? 'Creando…' : 'Crear ingrediente'}
              </button>
            </>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_quantity} onChange={(event) => setForm({ ...form, raw_quantity: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_quantity ?? '—')}</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <select value={form.validated_unit} onChange={(event) => setForm({ ...form, validated_unit: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1">
            <option value="">—</option>
            {PROCUREMENT_CANONICAL_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-1">
            <p>{line.validated_unit ?? line.normalized_unit_code ?? '—'}</p>
            <p className="text-[11px] text-slate-500">
              {line.validated_unit ? 'Unidad validada' : line.normalized_unit_code ? 'Unidad sugerida por pipeline (pendiente de validar)' : 'Sin unidad sugerida'}
            </p>
            {!line.validated_unit && line.normalized_unit_code ? <p className="text-[11px] text-emerald-300">Base sugerida para validar: {line.normalized_unit_code}</p> : null}
            <p className="text-xs text-slate-500">Original: {line.raw_unit ?? '—'}</p>
            {line.interpreted_unit ? <p className="text-[11px] text-sky-300">Sugerida pipeline: {line.interpreted_unit}</p> : null}
          </div>
        )}
      </td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_unit_price} onChange={(event) => setForm({ ...form, raw_unit_price: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_unit_price ?? '—')}</td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_line_total} onChange={(event) => setForm({ ...form, raw_line_total: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_line_total ?? '—')}</td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {dedupeWarnings(line.warning_notes, suggestedHint) || '—'}
        {duplicateHint?.hintType === 'duplicate' ? <p className="mt-1 text-amber-300">Posible duplicado de línea #{duplicateHint.duplicateOfLineNumber}: {duplicateHint.reason}</p> : null}
        {duplicateHint?.hintType === 'possible_shadow_code_line' ? <p className="mt-1 text-sky-300">Aviso línea sombra/código (relación con línea #{duplicateHint.duplicateOfLineNumber}): {duplicateHint.reason}</p> : null}
      </td>
      <td className="px-4 py-3">{isEditing ? <input value={form.user_note} onChange={(event) => setForm({ ...form, user_note: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.user_note ?? '—')}</td>
      <td className="px-4 py-3">{lineStatusLabel(line.line_status)}</td>
      <td className="px-4 py-3">
        {isDraft ? (
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={() => {
                  setForm(lineToFormSnapshot(line));
                  onFormDirtyChange(line.id, false);
                  onCancel();
                }}
                disabled={isRowBusy}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                Cancelar edición
              </button>
            ) : (
              <button type="button" onClick={onEdit} disabled={isRowBusy} className="rounded-full border border-slate-700 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500">
                Editar
              </button>
            )}
            <button
              type="button"
              disabled={!isDirty || isRowBusy}
              onClick={() => onSave(line, form)}
              className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
            >
              {isSaving ? 'Guardando…' : 'Guardar línea'}
            </button>
            {duplicateHint?.hintType === 'duplicate' && duplicateHint?.confidence === 'high' ? (
              <button
                type="button"
                disabled={isRowBusy}
                onClick={() => {
                  if (window.confirm('Se eliminará definitivamente esta línea duplicada sugerida. ¿Continuar?')) onDelete(line.id);
                }}
                className="rounded-full border border-amber-500/60 px-3 py-1 text-xs text-amber-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                Eliminar duplicado (definitivo)
              </button>
            ) : null}
            <button type="button" onClick={() => onDelete(line.id)} disabled={isRowBusy} className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500">
              {isDeleting ? 'Borrando…' : 'Borrar'}
            </button>
          </div>
        ) : <span className="text-xs text-slate-500">Solo lectura</span>}
      </td>
    </tr>
  );
}

function SearchableIngredientSelect({ value, onChange, ingredients, placeholder }: { value: string; onChange: (value: string) => void; ingredients: Ingredient[]; placeholder: string }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const skipNextValueSyncRef = useRef(false);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIngredient = useMemo(() => ingredients.find((ingredient) => ingredient.id === value) ?? null, [ingredients, value]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return ingredients.slice(0, 50);
    if (selectedIngredient && selectedIngredient.name.toLowerCase() === normalized) {
      return ingredients.slice(0, 50);
    }
    return ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(normalized)).slice(0, 80);
  }, [ingredients, query, selectedIngredient]);
  const hasFilteredResults = filtered.length > 0;

  useEffect(() => {
    if (skipNextValueSyncRef.current) {
      skipNextValueSyncRef.current = false;
      return;
    }
    setQuery(selectedIngredient?.name ?? '');
  }, [selectedIngredient?.name, value]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', onPointerDownOutside);
    return () => document.removeEventListener('pointerdown', onPointerDownOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      return;
    }
    if (!hasFilteredResults) {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) => {
      if (current >= 0 && current < filtered.length) return current;
      const selectedIndex = filtered.findIndex((ingredient) => ingredient.id === value);
      return selectedIndex >= 0 ? selectedIndex : 0;
    });
  }, [filtered, hasFilteredResults, isOpen, value]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  useEffect(() => {
    optionRefs.current = optionRefs.current.slice(0, filtered.length);
  }, [filtered.length]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const selectIngredient = useCallback(
    (ingredient: Ingredient) => {
      onChange(ingredient.id);
      setQuery(ingredient.name);
      closeDropdown();
    },
    [closeDropdown, onChange],
  );

  return (
    <div ref={rootRef} className="relative space-y-1 md:col-span-2">
      <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1">
        <input
          value={query}
          onFocus={() => {
            if (hasFilteredResults) setIsOpen(true);
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={isOpen && activeIndex >= 0 && filtered[activeIndex] ? `${listboxId}-option-${filtered[activeIndex].id}` : undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => {
                if (!filtered.length) return -1;
                if (current < 0) return 0;
                return Math.min(current + 1, filtered.length - 1);
              });
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => {
                if (!filtered.length) return -1;
                if (current < 0) return filtered.length - 1;
                return Math.max(current - 1, 0);
              });
              return;
            }
            if (event.key === 'Enter') {
              if (!isOpen) return;
              event.preventDefault();
              if (activeIndex < 0 || activeIndex >= filtered.length) return;
              selectIngredient(filtered[activeIndex]);
              return;
            }
            if (event.key === 'Escape') {
              if (!isOpen) return;
              event.preventDefault();
              closeDropdown();
              return;
            }
            if (event.key === 'Tab') {
              closeDropdown();
            }
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            const hasMatches = ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(nextQuery.trim().toLowerCase()));
            setIsOpen(hasMatches);
            setActiveIndex(-1);
            if (value) {
              skipNextValueSyncRef.current = true;
              onChange('');
            }
          }}
          placeholder="Buscar ingrediente…"
          className="w-full bg-transparent text-xs text-slate-200 outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              skipNextValueSyncRef.current = false;
              onChange('');
              setQuery('');
              closeDropdown();
            }}
            className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-slate-500">{selectedIngredient ? `Seleccionado: ${selectedIngredient.name}` : placeholder}</p>
      {isOpen && hasFilteredResults ? (
        <div id={listboxId} role="listbox" className="absolute z-20 max-h-56 w-full overflow-auto rounded-md border border-slate-700 bg-slate-950 shadow-xl">
          {filtered.map((ingredient, index) => (
            <button
              key={ingredient.id}
              id={`${listboxId}-option-${ingredient.id}`}
              type="button"
              role="option"
              aria-selected={value === ingredient.id}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                selectIngredient(ingredient);
              }}
              className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-slate-800 ${
                activeIndex === index && value === ingredient.id
                  ? 'bg-emerald-900/40 text-emerald-100'
                  : activeIndex === index
                    ? 'bg-slate-700 text-white'
                    : value === ingredient.id
                      ? 'bg-slate-800 text-emerald-200'
                      : 'text-slate-200'
              }`}
            >
              <span className="truncate">{ingredient.name}</span>
              {value === ingredient.id ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">✔</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <input type="hidden" value={value} readOnly />
      <button type="button" onClick={() => setIsOpen((current) => (hasFilteredResults ? !current : false))} className="text-[10px] text-slate-500 underline">
        {isOpen ? 'Ocultar resultados' : 'Mostrar resultados'}
      </button>
      <button type="button" onClick={closeDropdown} className="ml-2 text-[10px] text-slate-500 underline">
        Cerrar
      </button>
    </div>
  );
}

function dedupeWarnings(lineWarning: string | null, suggestedHint: LineSuggestionHint | null): string {
  const warnings = [lineWarning];
  if (suggestedHint?.hasAmbiguousTopMatch) warnings.push('Coincidencia ambigua en candidatos OCR.');
  if (!suggestedHint?.suggestedIngredientId) warnings.push('Sin match OCR fiable.');
  if (suggestedHint?.suggestedIngredientId && suggestedHint.hasNoStrongMatch) warnings.push('Match OCR débil para la sugerencia actual.');
  return Array.from(new Set(warnings.filter((warning): warning is string => Boolean(warning && warning.trim())))).join(' · ');
}
