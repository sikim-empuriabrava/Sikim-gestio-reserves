import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type ExternalReservationOfferingKind = 'cheffing_card' | 'cheffing_menu';

type ExternalReservationSettingsRow = {
  is_enabled: boolean | null;
  default_offering_kind: ExternalReservationOfferingKind | null;
  default_cheffing_card_id: string | null;
  default_cheffing_menu_id: string | null;
  updated_at: string | null;
};

export type ActiveCheffingCardOption = {
  id: string;
  name: string;
};

export type ActiveCheffingMenuOption = {
  id: string;
  name: string;
  price_per_person: number | null;
};

export type ExternalReservationSettingsSummary = {
  isEnabled: boolean;
  currentType: 'none' | ExternalReservationOfferingKind;
  currentTypeLabel: 'Sin asignacion' | 'Carta' | 'Menu';
  currentName: string | null;
  currentCardId: string | null;
  currentMenuId: string | null;
  updatedAt: string | null;
};

export type ExternalReservationSettingsAdminData = {
  summary: ExternalReservationSettingsSummary;
  cards: ActiveCheffingCardOption[];
  menus: ActiveCheffingMenuOption[];
};

function normalizePrice(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildSummary(
  settings: ExternalReservationSettingsRow | null,
  cards: ActiveCheffingCardOption[],
  menus: ActiveCheffingMenuOption[],
): ExternalReservationSettingsSummary {
  if (!settings || !settings.is_enabled) {
    return {
      isEnabled: false,
      currentType: 'none',
      currentTypeLabel: 'Sin asignacion',
      currentName: null,
      currentCardId: null,
      currentMenuId: null,
      updatedAt: settings?.updated_at ?? null,
    };
  }

  if (settings.default_offering_kind === 'cheffing_card') {
    const selectedCard = cards.find((card) => card.id === settings.default_cheffing_card_id) ?? null;

    return {
      isEnabled: true,
      currentType: 'cheffing_card',
      currentTypeLabel: 'Carta',
      currentName: selectedCard?.name ?? null,
      currentCardId: settings.default_cheffing_card_id ?? null,
      currentMenuId: null,
      updatedAt: settings.updated_at ?? null,
    };
  }

  if (settings.default_offering_kind === 'cheffing_menu') {
    const selectedMenu = menus.find((menu) => menu.id === settings.default_cheffing_menu_id) ?? null;

    return {
      isEnabled: true,
      currentType: 'cheffing_menu',
      currentTypeLabel: 'Menu',
      currentName: selectedMenu?.name ?? null,
      currentCardId: null,
      currentMenuId: settings.default_cheffing_menu_id ?? null,
      updatedAt: settings.updated_at ?? null,
    };
  }

  return {
    isEnabled: false,
    currentType: 'none',
    currentTypeLabel: 'Sin asignacion',
    currentName: null,
    currentCardId: null,
    currentMenuId: null,
    updatedAt: settings.updated_at ?? null,
  };
}

export async function loadExternalReservationSettingsAdminData(): Promise<ExternalReservationSettingsAdminData> {
  const supabase = createSupabaseAdminClient();

  const [{ data: settingsData, error: settingsError }, { data: cardsData, error: cardsError }, { data: menusData, error: menusError }] =
    await Promise.all([
      supabase
        .from('external_reservation_settings')
        .select('is_enabled, default_offering_kind, default_cheffing_card_id, default_cheffing_menu_id, updated_at')
        .eq('id', true)
        .maybeSingle(),
      supabase
        .from('cheffing_cards')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('cheffing_menus')
        .select('id, name, price_per_person')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  if (cardsError) {
    throw new Error(cardsError.message);
  }

  if (menusError) {
    throw new Error(menusError.message);
  }

  const cards = ((cardsData ?? []) as ActiveCheffingCardOption[]).map((card) => ({
    id: card.id,
    name: card.name,
  }));

  const menus = ((menusData ?? []) as Array<{ id: string; name: string; price_per_person: number | string | null }>).map(
    (menu) => ({
      id: menu.id,
      name: menu.name,
      price_per_person: normalizePrice(menu.price_per_person),
    }),
  );

  const settings = (settingsData ?? null) as ExternalReservationSettingsRow | null;

  return {
    summary: buildSummary(settings, cards, menus),
    cards,
    menus,
  };
}
