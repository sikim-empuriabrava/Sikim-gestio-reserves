import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { loadExternalReservationSettingsAdminData } from '@/lib/reservations/externalReservationSettings';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSettingsSchema = z
  .object({
    mode: z.enum(['none', 'cheffing_card', 'cheffing_menu']),
    cheffingCardId: z.string().uuid().nullable().optional(),
    cheffingMenuId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function PUT(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    const invalidBody = NextResponse.json({ error: 'Configuracion invalida.' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalidBody);
    return invalidBody;
  }

  const supabase = createSupabaseAdminClient();
  const payload = parsed.data;

  let settingsUpdate: {
    id: true;
    is_enabled: boolean;
    default_offering_kind: 'cheffing_card' | 'cheffing_menu' | null;
    default_cheffing_card_id: string | null;
    default_cheffing_menu_id: string | null;
  };

  if (payload.mode === 'none') {
    settingsUpdate = {
      id: true,
      is_enabled: false,
      default_offering_kind: null,
      default_cheffing_card_id: null,
      default_cheffing_menu_id: null,
    };
  } else if (payload.mode === 'cheffing_card') {
    if (!payload.cheffingCardId) {
      const missingCard = NextResponse.json(
        { error: 'Selecciona una carta activa antes de guardar.' },
        { status: 400 },
      );
      mergeResponseCookies(supabaseResponse, missingCard);
      return missingCard;
    }

    const { data: cardData, error: cardError } = await supabase
      .from('cheffing_cards')
      .select('id')
      .eq('id', payload.cheffingCardId)
      .eq('is_active', true)
      .maybeSingle();

    if (cardError) {
      console.error('[api/admin/external-reservation-settings] Failed to validate card', cardError);
      const validationError = NextResponse.json(
        { error: 'No se pudo validar la carta seleccionada.' },
        { status: 500 },
      );
      mergeResponseCookies(supabaseResponse, validationError);
      return validationError;
    }

    if (!cardData) {
      const invalidCard = NextResponse.json(
        { error: 'La carta seleccionada no existe o ya no esta activa.' },
        { status: 400 },
      );
      mergeResponseCookies(supabaseResponse, invalidCard);
      return invalidCard;
    }

    settingsUpdate = {
      id: true,
      is_enabled: true,
      default_offering_kind: 'cheffing_card',
      default_cheffing_card_id: payload.cheffingCardId,
      default_cheffing_menu_id: null,
    };
  } else {
    if (!payload.cheffingMenuId) {
      const missingMenu = NextResponse.json(
        { error: 'Selecciona un menu activo antes de guardar.' },
        { status: 400 },
      );
      mergeResponseCookies(supabaseResponse, missingMenu);
      return missingMenu;
    }

    const { data: menuData, error: menuError } = await supabase
      .from('cheffing_menus')
      .select('id')
      .eq('id', payload.cheffingMenuId)
      .eq('is_active', true)
      .maybeSingle();

    if (menuError) {
      console.error('[api/admin/external-reservation-settings] Failed to validate menu', menuError);
      const validationError = NextResponse.json(
        { error: 'No se pudo validar el menu seleccionado.' },
        { status: 500 },
      );
      mergeResponseCookies(supabaseResponse, validationError);
      return validationError;
    }

    if (!menuData) {
      const invalidMenu = NextResponse.json(
        { error: 'El menu seleccionado no existe o ya no esta activo.' },
        { status: 400 },
      );
      mergeResponseCookies(supabaseResponse, invalidMenu);
      return invalidMenu;
    }

    settingsUpdate = {
      id: true,
      is_enabled: true,
      default_offering_kind: 'cheffing_menu',
      default_cheffing_card_id: null,
      default_cheffing_menu_id: payload.cheffingMenuId,
    };
  }

  const { error: updateError } = await supabase
    .from('external_reservation_settings')
    .upsert(settingsUpdate, { onConflict: 'id' });

  if (updateError) {
    console.error('[api/admin/external-reservation-settings] Failed to save settings', updateError);
    const saveError = NextResponse.json(
      { error: 'No se pudo guardar la configuracion de reservas externas.' },
      { status: 500 },
    );
    mergeResponseCookies(supabaseResponse, saveError);
    return saveError;
  }

  try {
    const data = await loadExternalReservationSettingsAdminData();
    const response = NextResponse.json({ ok: true, settings: data.summary });
    mergeResponseCookies(supabaseResponse, response);
    return response;
  } catch (error) {
    console.error('[api/admin/external-reservation-settings] Failed to reload saved settings', error);
    const response = NextResponse.json({
      ok: true,
      settings: {
        isEnabled: settingsUpdate.is_enabled,
        currentType: settingsUpdate.default_offering_kind ?? 'none',
        currentTypeLabel:
          settingsUpdate.default_offering_kind === 'cheffing_card'
            ? 'Carta'
            : settingsUpdate.default_offering_kind === 'cheffing_menu'
              ? 'Menu'
              : 'Sin asignacion',
        currentName: null,
        currentCardId: settingsUpdate.default_cheffing_card_id,
        currentMenuId: settingsUpdate.default_cheffing_menu_id,
        updatedAt: null,
      },
    });
    mergeResponseCookies(supabaseResponse, response);
    return response;
  }
}
