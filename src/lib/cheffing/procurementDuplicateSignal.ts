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
  supplier_id: string | null;
  document_kind: string;
  document_number: string | null;
  document_date: string;
  declared_total: number | null;
  interpreted_payload: Record<string, unknown> | null;
};

function normalizeDocumentNumber(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

function safePayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
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
    .select('id, status, supplier_id, document_kind, document_number, document_date, declared_total, interpreted_payload')
    .eq('id', documentId)
    .maybeSingle<DocumentForDuplicateCheck>();

  if (currentDocumentError || !currentDocument) {
    throw new Error('Could not load current document for duplicate check');
  }

  const { data: candidates, error: candidatesError } = await supabase
    .from('cheffing_purchase_documents')
    .select('id, status, supplier_id, document_kind, document_number, document_date, declared_total')
    .neq('id', documentId)
    .in('status', ['draft', 'applied'])
    .eq('document_kind', currentDocument.document_kind)
    .order('created_at', { ascending: false })
    .limit(60);

  if (candidatesError) {
    throw new Error('Could not load duplicate candidates');
  }

  const currentDocNumber = normalizeDocumentNumber(currentDocument.document_number);
  const duplicateCandidates: { id: string; score: number; reasons: string[] }[] = [];

  for (const candidate of candidates ?? []) {
    let score = 0;
    const reasons: string[] = [];

    const candidateDocNumber = normalizeDocumentNumber(candidate.document_number);
    if (currentDocNumber && candidateDocNumber && currentDocNumber === candidateDocNumber) {
      score += 5;
      reasons.push('same_document_number');
    }

    if (currentDocument.document_date === candidate.document_date) {
      score += 1;
      reasons.push('same_document_date');
    }

    if (currentDocument.supplier_id && candidate.supplier_id && currentDocument.supplier_id === candidate.supplier_id) {
      score += 2;
      reasons.push('same_supplier');
    }

    if (
      currentDocument.declared_total !== null &&
      candidate.declared_total !== null &&
      Math.abs(currentDocument.declared_total - candidate.declared_total) <= 0.01
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
