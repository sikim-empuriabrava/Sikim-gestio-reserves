import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { getAllowlistRoleForUserEmail } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MenuCatalogRow = {
  id: string;
  name: string;
  price_per_person: number | null;
  is_active: boolean;
};

type MenuItemRow = {
  menu_id: string;
  sort_order: number;
  section_kind: 'starter' | 'main' | 'drink' | 'dessert';
  notes: string | null;
  cheffing_dishes: {
    id: string;
    name: string;
    notes: string | null;
  } | null;
};

function needsDonenessPointsFromDishName(name: string) {
  const normalized = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  return normalized.includes('entrecot') || normalized.includes('entrecote');
}

export async function GET() {
  const noStoreHeaders = { 'Cache-Control': 'no-store' };
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json(
      { error: 'Not allowed' },
      { status: 403, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json(
      { error: 'Allowlist check failed' },
      { status: 500, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json(
      { error: 'Forbidden' },
      { status: 403, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const supabase = createSupabaseAdminClient();

  const { data: menusData, error: menusError } = await supabase
    .from('cheffing_menus')
    .select('id, name, price_per_person, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (menusError) {
    const response = NextResponse.json(
      { error: menusError.message ?? 'Unknown error loading menus' },
      { status: 500, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, response);
    return response;
  }

  const activeMenus = (menusData ?? []) as MenuCatalogRow[];
  const menuIds = activeMenus.map((menu) => menu.id);
  let menuItemsByMenuId = new Map<string, MenuItemRow[]>();

  if (menuIds.length > 0) {
    const { data: menuItemsData, error: menuItemsError } = await supabase
      .from('cheffing_menu_items')
      .select(
        'menu_id, sort_order, section_kind, notes, cheffing_dishes(id, name, notes)',
      )
      .in('menu_id', menuIds)
      .eq('section_kind', 'main')
      .order('sort_order', { ascending: true });

    if (menuItemsError) {
      const response = NextResponse.json(
        { error: menuItemsError.message ?? 'Unknown error loading menu items' },
        { status: 500, headers: noStoreHeaders },
      );
      mergeResponseCookies(supabaseResponse, response);
      return response;
    }

    menuItemsByMenuId = (menuItemsData ?? []).reduce<Map<string, MenuItemRow[]>>((acc, item) => {
      const typedItem = item as unknown as MenuItemRow;
      const existing = acc.get(typedItem.menu_id) ?? [];
      existing.push(typedItem);
      acc.set(typedItem.menu_id, existing);
      return acc;
    }, new Map());
  }

  const normalizedMenus = activeMenus.map((menu) => {
    const secondCourses = (menuItemsByMenuId.get(menu.id) ?? [])
      .filter((item) => item.cheffing_dishes?.id && item.cheffing_dishes?.name)
      .map((item) => {
        const dish = item.cheffing_dishes as NonNullable<MenuItemRow['cheffing_dishes']>;
        return {
          id: dish.id,
          code: `MAIN-${dish.id.slice(0, 8).toUpperCase()}`,
          nombre: dish.name,
          descripcion: item.notes ?? dish.notes ?? '',
          needsDonenessPoints: needsDonenessPointsFromDishName(dish.name),
        };
      });

    return {
      id: menu.id,
      code: `CHEF-${menu.id.slice(0, 8).toUpperCase()}`,
      display_name: menu.name,
      price_eur: menu.price_per_person,
      source_kind: 'cheffing_menu' as const,
      cheffing_menu_id: menu.id,
      legacy_menu_id: menu.id,
      mapping_source: 'cheffing_menu_direct' as const,
      segundos: secondCourses,
    };
  });

  const response = NextResponse.json({ menus: normalizedMenus }, { headers: noStoreHeaders });
  mergeResponseCookies(supabaseResponse, response);

  return response;
}
