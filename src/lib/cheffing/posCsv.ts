export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

const normalizeHeader = (header: string) =>
  header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

export function parseDecimalEs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const isoCandidate = normalized.replace(' ', 'T');
  const parsed = new Date(isoCandidate);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const [datePart, timePart = '00:00:00'] = normalized.split(' ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }

  const safeTime = /^\d{2}:\d{2}:\d{2}$/.test(timePart) ? timePart : `${timePart}:00`.slice(0, 8);
  return `${datePart} ${safeTime}`;
}

export function parseCsvSemicolon(content: string): ParsedCsv {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseLine = (line: string) => line.split(';').map((cell) => cell.trim());

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });

  return { headers, rows };
}

export function resolveHeaderMap(
  headers: string[],
  expected: Record<string, readonly string[]>,
): { missing: string[]; resolved: Record<string, string> } {
  const normalizedIndex = new Map<string, string>();

  for (const header of headers) {
    normalizedIndex.set(normalizeHeader(header), header);
  }

  const resolved: Record<string, string> = {};
  const missing: string[] = [];

  for (const [field, aliases] of Object.entries(expected) as Array<[string, readonly string[]]>) {
    const found = aliases
      .map((alias) => normalizedIndex.get(normalizeHeader(alias)))
      .find((value): value is string => Boolean(value));

    if (!found) {
      missing.push(field);
      continue;
    }

    resolved[field] = found;
  }

  return { missing, resolved };
}
