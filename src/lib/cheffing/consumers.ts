import { applyPortionMultiplier } from '@/lib/cheffing/portionMultiplier';

export type CheffingConsumerDish = {
  id: string;
  name: string;
  family_name: string | null;
  family_kind: 'food' | 'drink' | null;
  items_cost_total: number | null;
  selling_price: number | null;
};

export type CheffingConsumerItem = {
  id: string;
  dish_id: string;
  multiplier: number;
  sort_order: number;
  notes: string | null;
  dish?: CheffingConsumerDish | null;
};

export type ConsumerTotalDiagnostics = {
  calculation_status: 'empty' | 'ok' | 'blocked';
  total: number | null;
  blocking_reasons: string[];
};

export const resolveConsumerDishKind = (dish: CheffingConsumerDish): 'food' | 'drink' => {
  if (dish.family_kind === 'drink') return 'drink';
  return 'food';
};

export const getConsumerLineCost = (dishCost: number | null, multiplier: number) => {
  if (dishCost === null) return null;
  return applyPortionMultiplier({ baseAmount: dishCost, multiplier });
};

export const getConsumerLinePrice = (dishPrice: number | null, multiplier: number) => {
  if (dishPrice === null) return null;
  return applyPortionMultiplier({ baseAmount: dishPrice, multiplier });
};

export const getConsumerLineMargin = ({
  cost,
  price,
}: {
  cost: number | null;
  price: number | null;
}) => {
  if (cost === null || price === null) return null;
  return Number((price - cost).toFixed(4));
};

export const getConsumerConservativeCostTotal = (
  items: Array<{ lineName: string; cost: number | null; fallbackLabel?: string }>,
): ConsumerTotalDiagnostics => {
  if (items.length === 0) {
    return {
      calculation_status: 'empty',
      total: 0,
      blocking_reasons: [],
    };
  }

  const diagnostics = items.reduce(
    (acc, item) => {
      if (item.cost === null) {
        acc.blocking_reasons.push(
          `No se puede calcular el coste total porque la línea "${item.lineName || item.fallbackLabel || 'Sin nombre'}" no tiene coste base calculable.`,
        );
        return acc;
      }
      acc.runningTotal += item.cost;
      return acc;
    },
    { runningTotal: 0, blocking_reasons: [] as string[] },
  );

  if (diagnostics.blocking_reasons.length > 0) {
    return {
      calculation_status: 'blocked',
      total: null,
      blocking_reasons: diagnostics.blocking_reasons,
    };
  }

  const total = Number(diagnostics.runningTotal.toFixed(4));

  return {
    calculation_status: 'ok',
    total,
    blocking_reasons: [],
  };
};

export const getConservativeMarginDiagnostics = ({
  totalCost,
  price,
  label,
}: {
  totalCost: number | null;
  price: number | null;
  label: string;
}) => {
  if (price === null) {
    return {
      margin: null,
      blocking_reasons: [`No se puede calcular el margen porque ${label} no tiene precio configurado.`],
    };
  }

  if (totalCost === null) {
    return {
      margin: null,
      blocking_reasons: [`No se puede calcular el margen porque ${label} tiene líneas sin coste calculable.`],
    };
  }

  return {
    margin: Number((price - totalCost).toFixed(4)),
    blocking_reasons: [],
  };
};

export const getNextConsumerSortOrder = (items: Array<{ sort_order: number }>) => {
  if (items.length === 0) return 0;
  const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sort_order), Number.NEGATIVE_INFINITY);
  return maxSortOrder + 1;
};
