import { createSupabaseServerClient } from '@/lib/supabase/server';

export type DishUsageConsumer = {
  id: string;
  name: string;
  is_active: boolean;
};

export type DishUsageSummary = {
  cards: DishUsageConsumer[];
  menus: DishUsageConsumer[];
  hasAnyUsage: boolean;
  hasActiveUsage: boolean;
};

type UsageRows = {
  cards: { id: string; name: string; is_active: boolean }[];
  cardItems: { card_id: string; dish_id: string }[];
  menus: { id: string; name: string; is_active: boolean }[];
  menuItems: { menu_id: string; dish_id: string }[];
};

export async function loadCheffingDishUsage() {
  const supabase = createSupabaseServerClient();

  const [{ data: cards, error: cardsError }, { data: cardItems, error: cardItemsError }, { data: menus, error: menusError }, { data: menuItems, error: menuItemsError }] =
    await Promise.all([
      supabase.from('cheffing_cards').select('id, name, is_active'),
      supabase.from('cheffing_card_items').select('card_id, dish_id'),
      supabase.from('cheffing_menus').select('id, name, is_active'),
      supabase.from('cheffing_menu_items').select('menu_id, dish_id'),
    ]);

  const error = cardsError ?? cardItemsError ?? menusError ?? menuItemsError ?? null;
  return {
    rows: {
      cards: cards ?? [],
      cardItems: cardItems ?? [],
      menus: menus ?? [],
      menuItems: menuItems ?? [],
    } satisfies UsageRows,
    error,
  };
}

export function buildDishUsageIndex({ cards, cardItems, menus, menuItems }: UsageRows) {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const menusById = new Map(menus.map((menu) => [menu.id, menu]));
  const usageByDishId = new Map<string, DishUsageSummary>();

  const getOrCreateUsage = (dishId: string) => {
    const current = usageByDishId.get(dishId);
    if (current) return current;

    const created: DishUsageSummary = {
      cards: [],
      menus: [],
      hasAnyUsage: false,
      hasActiveUsage: false,
    };
    usageByDishId.set(dishId, created);
    return created;
  };

  for (const item of cardItems) {
    const card = cardsById.get(item.card_id);
    if (!card) continue;

    const usage = getOrCreateUsage(item.dish_id);
    usage.cards.push({ id: card.id, name: card.name, is_active: card.is_active });
  }

  for (const item of menuItems) {
    const menu = menusById.get(item.menu_id);
    if (!menu) continue;

    const usage = getOrCreateUsage(item.dish_id);
    usage.menus.push({ id: menu.id, name: menu.name, is_active: menu.is_active });
  }

  usageByDishId.forEach((usage) => {
    usage.cards.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    usage.menus.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    usage.hasAnyUsage = usage.cards.length > 0 || usage.menus.length > 0;
    usage.hasActiveUsage = usage.cards.some((card) => card.is_active) || usage.menus.some((menu) => menu.is_active);
  });

  return usageByDishId;
}
