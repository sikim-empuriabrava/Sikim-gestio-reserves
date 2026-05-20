export type CustomerContactType = 'phone' | 'email';

export function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function normalizePhone(value: string | null | undefined) {
  const raw = value?.trim() ?? '';
  if (!raw) return null;

  const stripSeparators = (input: string) =>
    input.replaceAll(' ', '').replaceAll('-', '').replaceAll('(', '').replaceAll(')', '');

  const normalized = raw.startsWith('+')
    ? `+${stripSeparators(raw.slice(1))}`
    : stripSeparators(raw);

  return normalized && normalized !== '+' ? normalized : null;
}

export function normalizeContactValue(type: CustomerContactType, value: string | null | undefined) {
  return type === 'email' ? normalizeEmail(value) : normalizePhone(value);
}

export function getContactDisplayValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}
