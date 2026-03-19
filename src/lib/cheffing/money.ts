export const roundToEditableMoney = (value: number) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const formatEditableMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }

  return roundToEditableMoney(value).toFixed(2);
};

export const parseEditableMoney = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return roundToEditableMoney(numericValue);
};
