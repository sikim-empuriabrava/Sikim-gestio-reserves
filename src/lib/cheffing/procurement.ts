export const PROCUREMENT_DOCUMENT_STATUSES = ['draft', 'applied', 'discarded'] as const;
export type ProcurementDocumentStatus = (typeof PROCUREMENT_DOCUMENT_STATUSES)[number];

export const PROCUREMENT_DOCUMENT_KINDS = ['invoice', 'delivery_note', 'other'] as const;
export type ProcurementDocumentKind = (typeof PROCUREMENT_DOCUMENT_KINDS)[number];

export const PROCUREMENT_LINE_STATUSES = ['unresolved', 'resolved'] as const;
export type ProcurementLineStatus = (typeof PROCUREMENT_LINE_STATUSES)[number];

export const PROCUREMENT_CANONICAL_UNITS = ['ud', 'kg', 'g', 'l', 'ml', 'caja', 'pack'] as const;
export type ProcurementCanonicalUnit = (typeof PROCUREMENT_CANONICAL_UNITS)[number];

export const PROCUREMENT_SOURCE_FILE_BUCKET = 'cheffing-procurement-documents';
export const PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const PROCUREMENT_SOURCE_FILE_ACCEPT_ATTRIBUTE = PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES.join(',');
export const PROCUREMENT_SOURCE_IMAGE_FILE_ACCEPT_ATTRIBUTE = PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES
  .filter((mimeType) => mimeType.startsWith('image/'))
  .join(',');

const MIME_TO_EXTENSION: Record<(typeof PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES)[number], string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function procurementMimeToExtension(mimeType: string): string | null {
  return MIME_TO_EXTENSION[mimeType as keyof typeof MIME_TO_EXTENSION] ?? null;
}

export function inferProcurementSourceFileKind(storagePath: string | null | undefined): 'image' | 'pdf' | 'unknown' {
  const path = storagePath?.toLowerCase() ?? '';
  if (!path.length) return 'unknown';
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || path.endsWith('.webp')) return 'image';
  return 'unknown';
}

export function normalizeProcurementText(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function normalizeProcurementCanonicalUnit(value: unknown): ProcurementCanonicalUnit | null | typeof Number.NaN {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return Number.NaN;
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) return null;
  if (PROCUREMENT_CANONICAL_UNITS.includes(normalized as ProcurementCanonicalUnit)) {
    return normalized as ProcurementCanonicalUnit;
  }
  return Number.NaN;
}

export function documentStatusLabel(status: ProcurementDocumentStatus): string {
  if (status === 'draft') return 'Borrador / pendiente';
  if (status === 'applied') return 'Aplicado';
  return 'Descartado';
}

export function documentKindLabel(kind: ProcurementDocumentKind): string {
  if (kind === 'invoice') return 'Factura';
  if (kind === 'delivery_note') return 'Albarán';
  return 'Otro';
}

export function lineStatusLabel(status: ProcurementLineStatus): string {
  return status === 'resolved' ? 'Resuelta' : 'Pendiente';
}
