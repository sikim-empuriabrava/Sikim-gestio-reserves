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

export const getConsumerTotalCost = (items: Array<{ cost: number | null }>) => {
  const validCosts = items.map((item) => item.cost).filter((value): value is number => Number.isFinite(value));
  if (validCosts.length === 0) return 0;
  return Number(validCosts.reduce((acc, value) => acc + value, 0).toFixed(4));
};
