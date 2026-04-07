import type { SupabaseClient } from '@supabase/supabase-js';

type ProcurementDocumentDuplicateSignal = {
  status: 'none' | 'possible_duplicate';
  checked_at: string;
  score: number;
  reasons: string[];
  candidate_document_ids: string[];
};

type DocumentForDuplicateCheck = {
  id: string;
  status: 'draft' | 'applied' | 'discarded';
  created_at: string;
  supplier_id: string | null;
  document_kind: string;
  document_number: string | null;
  document_date: string;
  declared_total: number | null;
  interpreted_payload: Record<string, unknown> | null;
};

type DuplicateComparableFields = {
  documentNumber: string | null;
  documentDate: string;
  supplierId: string | null;
  declaredTotal: number | null;
};

function normalizeDocumentNumber(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeSupplierId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDeclaredTotal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function safePayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getPayloadRecord(payload: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const candidate = payload?.[key];
  return candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : null;
}

function getComparableFields(document: DocumentForDuplicateCheck): DuplicateComparableFields {
  const payload = safePayload(document.interpreted_payload);
  const detectedDocument = getPayloadRecord(payload, 'document_detected');
  const supplierSuggestion = getPayloadRecord(payload, 'supplier_existing_suggestion');
  const dbDate = normalizeDate(document.document_date);
  const detectedDate = normalizeDate(detectedDocument?.document_date);
  const createdDate = normalizeDate(document.created_at?.slice(0, 10));
  const shouldUseDetectedDate = Boolean(detectedDate) && (!dbDate || (createdDate && dbDate === createdDate));
  const suggestionIsStrong =
    supplierSuggestion?.should_auto_select === true ||
    (supplierSuggestion?.is_strong_match === true && supplierSuggestion?.is_dominant === true);

  return {
    documentNumber:
      normalizeDocumentNumber(document.document_number) ??
      normalizeDocumentNumber(typeof detectedDocument?.document_number === 'string' ? detectedDocument.document_number : null),
    documentDate: (shouldUseDetectedDate ? detectedDate : dbDate) ?? detectedDate ?? dbDate ?? new Date().toISOString().slice(0, 10),
    supplierId:
      normalizeSupplierId(document.supplier_id) ??
      (suggestionIsStrong ? normalizeSupplierId(supplierSuggestion?.supplier_id) : null),
    declaredTotal:
      normalizeDeclaredTotal(document.declared_total) ??
      normalizeDeclaredTotal(detectedDocument?.declared_total),
  };
}

function withDuplicateSignal(
  currentPayload: Record<string, unknown> | null,
  signal: ProcurementDocumentDuplicateSignal,
): Record<string, unknown> {
  return {
    ...safePayload(currentPayload),
    possible_document_duplicate: signal,
  };
}

export async function upsertPossibleDocumentDuplicateSignal({
  supabase,
  documentId,
}: {
  supabase: SupabaseClient;
  documentId: string;
}) {
  const { data: currentDocument, error: currentDocumentError } = await supabase
    .from('cheffing_purchase_documents')
    .select('id, status, created_at, supplier_id, document_kind, document_number, document_date, declared_total, interpreted_payload')
    .eq('id', documentId)
    .maybeSingle<DocumentForDuplicateCheck>();

  if (currentDocumentError || !currentDocument) {
    throw new Error('Could not load current document for duplicate check');
  }

  const { data: candidates, error: candidatesError } = await supabase
    .from('cheffing_purchase_documents')
    .select('id, status, created_at, supplier_id, document_kind, document_number, document_date, declared_total, interpreted_payload')
    .neq('id', documentId)
    .in('status', ['draft', 'applied'])
    .eq('document_kind', currentDocument.document_kind)
    .order('created_at', { ascending: false })
    .limit(60);

  if (candidatesError) {
    throw new Error('Could not load duplicate candidates');
  }

  const currentComparable = getComparableFields(currentDocument);
  const duplicateCandidates: { id: string; score: number; reasons: string[] }[] = [];

  for (const candidate of (candidates ?? []) as DocumentForDuplicateCheck[]) {
    const candidateComparable = getComparableFields(candidate);
    let score = 0;
    const reasons: string[] = [];

    if (
      currentComparable.documentNumber &&
      candidateComparable.documentNumber &&
      currentComparable.documentNumber === candidateComparable.documentNumber
    ) {
      score += 5;
      reasons.push('same_document_number');
    }

    if (currentComparable.documentDate === candidateComparable.documentDate) {
      score += 1;
      reasons.push('same_document_date');
    }

    if (
      currentComparable.supplierId &&
      candidateComparable.supplierId &&
      currentComparable.supplierId === candidateComparable.supplierId
    ) {
      score += 2;
      reasons.push('same_supplier');
    }

    if (
      currentComparable.declaredTotal !== null &&
      candidateComparable.declaredTotal !== null &&
      Math.abs(currentComparable.declaredTotal - candidateComparable.declaredTotal) <= 0.01
    ) {
      score += 2;
      reasons.push('same_declared_total');
    }

    const strongComposite =
      (reasons.includes('same_document_number') && reasons.includes('same_document_date')) ||
      (reasons.includes('same_supplier') && reasons.includes('same_document_date') && reasons.includes('same_declared_total'));

    if (score >= 5 && strongComposite) {
      duplicateCandidates.push({ id: candidate.id, score, reasons });
    }
  }

  duplicateCandidates.sort((a, b) => b.score - a.score);
  const topCandidate = duplicateCandidates[0] ?? null;

  const signal: ProcurementDocumentDuplicateSignal = {
    status: topCandidate ? 'possible_duplicate' : 'none',
    checked_at: new Date().toISOString(),
    score: topCandidate?.score ?? 0,
    reasons: topCandidate?.reasons ?? [],
    candidate_document_ids: duplicateCandidates.slice(0, 5).map((entry) => entry.id),
  };

  const nextPayload = withDuplicateSignal(currentDocument.interpreted_payload, signal);

  const { error: updateError } = await supabase
    .from('cheffing_purchase_documents')
    .update({ interpreted_payload: nextPayload })
    .eq('id', documentId);

  if (updateError) {
    throw new Error('Could not persist duplicate signal');
  }

  return signal;
}
