export const PROCUREMENT_DRAFT_CONTACT_REVIEW_KEY = 'supplier_contact_review';

export type ProcurementDraftSupplierContactReview = {
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  updated_at: string;
};

export function normalizeSupplierComparable(field: 'tax_id' | 'email' | 'phone', value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (field === 'tax_id') return trimmed.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (field === 'email') return trimmed.toLowerCase();
  return trimmed.replace(/[^\d+]/g, '');
}

export function mergeUniqueSupplierContactValues(field: 'email' | 'phone', existingValue: string, detectedValue: string): string {
  const splitRegex = /[;,|/]+/;
  const values = `${existingValue}${field === 'email' ? ';' : ' / '}${detectedValue}`
    .split(splitRegex)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeSupplierComparable(field, value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(value);
  }

  return unique.join(field === 'email' ? '; ' : ' / ');
}

export function upsertDraftSupplierContactReview(params: {
  interpretedPayload: unknown;
  supplierContactUpdates: { tax_id?: string | null; email?: string | null; phone?: string | null };
}): Record<string, unknown> {
  const base =
    params.interpretedPayload && typeof params.interpretedPayload === 'object'
      ? ({ ...(params.interpretedPayload as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const nextReview: ProcurementDraftSupplierContactReview = {
    ...(typeof base[PROCUREMENT_DRAFT_CONTACT_REVIEW_KEY] === 'object' && base[PROCUREMENT_DRAFT_CONTACT_REVIEW_KEY]
      ? (base[PROCUREMENT_DRAFT_CONTACT_REVIEW_KEY] as ProcurementDraftSupplierContactReview)
      : {}),
    updated_at: new Date().toISOString(),
  };

  for (const field of ['tax_id', 'email', 'phone'] as const) {
    if (params.supplierContactUpdates[field] !== undefined) {
      nextReview[field] = params.supplierContactUpdates[field] ?? null;
    }
  }

  base[PROCUREMENT_DRAFT_CONTACT_REVIEW_KEY] = nextReview;
  return base;
}

export function readDraftSupplierContactReview(interpretedPayload: unknown): ProcurementDraftSupplierContactReview | null {
  if (!interpretedPayload || typeof interpretedPayload !== 'object') return null;
  const review = (interpretedPayload as Record<string, unknown>)[PROCUREMENT_DRAFT_CONTACT_REVIEW_KEY];
  if (!review || typeof review !== 'object') return null;
  const typed = review as Record<string, unknown>;

  const normalized: ProcurementDraftSupplierContactReview = {
    updated_at: typeof typed.updated_at === 'string' ? typed.updated_at : new Date(0).toISOString(),
  };

  for (const field of ['tax_id', 'email', 'phone'] as const) {
    const value = typed[field];
    if (value === null) normalized[field] = null;
    else if (typeof value === 'string') normalized[field] = value.trim() || null;
  }

  return normalized;
}
