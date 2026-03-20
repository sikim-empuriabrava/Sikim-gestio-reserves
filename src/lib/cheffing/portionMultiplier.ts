export const DEFAULT_PORTION_MULTIPLIER = 1;

const STORAGE_DECIMALS = 4;

const roundMultiplier = (value: number) => {
  const factor = 10 ** STORAGE_DECIMALS;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const parsePortionMultiplier = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return DEFAULT_PORTION_MULTIPLIER;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return DEFAULT_PORTION_MULTIPLIER;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return roundMultiplier(parsed);
  }

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return roundMultiplier(value);
};

export const isValidPortionMultiplier = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

export const applyPortionMultiplier = ({
  baseAmount,
  multiplier,
}: {
  baseAmount: number;
  multiplier: number;
}) => {
  if (!Number.isFinite(baseAmount)) {
    return null;
  }

  if (!isValidPortionMultiplier(multiplier)) {
    return null;
  }

  return roundMultiplier(baseAmount * multiplier);
};
