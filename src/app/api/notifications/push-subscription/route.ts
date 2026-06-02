import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  canReceiveExternalReservationNotifications,
  getAllowlistRoleForUserEmail,
} from '@/lib/auth/requireRole';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const subscriptionSchema = z
  .object({
    endpoint: z.string().trim().url().min(1).max(4096),
    keys: z
      .object({
        p256dh: z.string().trim().min(1).max(512),
        auth: z.string().trim().min(1).max(256),
      })
      .strict(),
    deviceLabel: z.string().trim().max(120).optional(),
  })
  .strict();

const deleteSchema = z
  .object({
    endpoint: z.string().trim().url().min(1).max(4096),
  })
  .strict();

type AuthResult =
  | {
      ok: true;
      requesterEmail: string;
      canReceiveNotifications: boolean;
      supabaseResponse: NextResponse;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function hasVapidPublicKey() {
  return Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim());
}

async function authorizeRequest(): Promise<AuthResult> {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return { ok: false, response: unauthorized };
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return { ok: false, response: notAllowed };
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return { ok: false, response: allowlistError };
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return { ok: false, response: forbidden };
  }

  return {
    ok: true,
    requesterEmail,
    canReceiveNotifications: canReceiveExternalReservationNotifications(
      allowlistInfo.role,
      allowlistInfo.allowedUser,
    ),
    supabaseResponse,
  };
}

function jsonWithCookies(supabaseResponse: NextResponse, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}

export async function GET(req: NextRequest) {
  const auth = await authorizeRequest();

  if (!auth.ok) {
    return auth.response;
  }

  const endpoint = req.nextUrl.searchParams.get('endpoint')?.trim() || null;
  let deviceActive: boolean | null = null;

  if (endpoint) {
    if (endpoint.length > 4096) {
      return jsonWithCookies(auth.supabaseResponse, { error: 'Invalid endpoint' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('web_push_subscriptions')
      .select('is_active')
      .eq('user_email', auth.requesterEmail)
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (error) {
      console.error('[api/notifications/push-subscription] Failed to check device subscription', error);
      return jsonWithCookies(
        auth.supabaseResponse,
        { error: 'No se pudo consultar el estado del dispositivo.' },
        { status: 500 },
      );
    }

    deviceActive = Boolean(data?.is_active);
  }

  return jsonWithCookies(auth.supabaseResponse, {
    ok: true,
    canReceiveNotifications: auth.canReceiveNotifications,
    vapidPublicKeyConfigured: hasVapidPublicKey(),
    vapidPublicKey: process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || null,
    deviceActive,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRequest();

  if (!auth.ok) {
    return auth.response;
  }

  if (!auth.canReceiveNotifications) {
    return jsonWithCookies(auth.supabaseResponse, { error: 'Forbidden' }, { status: 403 });
  }

  if (!hasVapidPublicKey()) {
    return jsonWithCookies(
      auth.supabaseResponse,
      { error: 'La configuracion de Web Push esta incompleta.' },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = subscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonWithCookies(auth.supabaseResponse, { error: 'Subscription invalida.' }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent')?.trim().slice(0, 512) || null;
  const supabase = createSupabaseAdminClient();
  const { endpoint, keys, deviceLabel } = parsed.data;

  const { error } = await supabase.from('web_push_subscriptions').upsert(
    {
      user_email: auth.requesterEmail,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device_label: deviceLabel || null,
      user_agent: userAgent,
      is_active: true,
      last_seen_at: new Date().toISOString(),
      disabled_at: null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('[api/notifications/push-subscription] Failed to save subscription', error);
    return jsonWithCookies(
      auth.supabaseResponse,
      { error: 'No se pudo guardar la subscription del dispositivo.' },
      { status: 500 },
    );
  }

  return jsonWithCookies(auth.supabaseResponse, { ok: true, deviceActive: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeRequest();

  if (!auth.ok) {
    return auth.response;
  }

  if (!auth.canReceiveNotifications) {
    return jsonWithCookies(auth.supabaseResponse, { error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return jsonWithCookies(auth.supabaseResponse, { error: 'Endpoint invalido.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('web_push_subscriptions')
    .update({
      is_active: false,
      disabled_at: new Date().toISOString(),
    })
    .eq('user_email', auth.requesterEmail)
    .eq('endpoint', parsed.data.endpoint);

  if (error) {
    console.error('[api/notifications/push-subscription] Failed to disable subscription', error);
    return jsonWithCookies(
      auth.supabaseResponse,
      { error: 'No se pudo desactivar la subscription del dispositivo.' },
      { status: 500 },
    );
  }

  return jsonWithCookies(auth.supabaseResponse, { ok: true, deviceActive: false });
}
