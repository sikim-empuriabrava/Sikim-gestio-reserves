export const PROCUREMENT_DOCUMENT_STATUSES = ['draft', 'applied', 'discarded'] as const;
export type ProcurementDocumentStatus = (typeof PROCUREMENT_DOCUMENT_STATUSES)[number];

export const PROCUREMENT_DOCUMENT_KINDS = ['invoice', 'delivery_note', 'other'] as const;
export type ProcurementDocumentKind = (typeof PROCUREMENT_DOCUMENT_KINDS)[number];

export const PROCUREMENT_LINE_STATUSES = ['unresolved', 'resolved'] as const;
export type ProcurementLineStatus = (typeof PROCUREMENT_LINE_STATUSES)[number];

export function normalizeProcurementText(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
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
