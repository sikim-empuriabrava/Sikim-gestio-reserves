import 'server-only';

import webPush from 'web-push';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

type ExternalReservationPushInput = {
  groupEventId: string;
  name: string;
  eventDate: string;
  entryTime: string;
  totalPax: number;
  sourceLabel: string | null;
};

type NotificationRecipientRow = {
  email: string | null;
};

type WebPushSubscriptionRow = {
  id: string;
  user_email: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

const INVALID_SUBSCRIPTION_STATUS_CODES = new Set([404, 410]);

function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  const missing = [
    ['NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', publicKey],
    ['WEB_PUSH_VAPID_PRIVATE_KEY', privateKey],
    ['WEB_PUSH_VAPID_SUBJECT', subject],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (!publicKey || !privateKey || !subject) {
    console.warn('[notifications/external-reservation-push] Web Push is not configured', {
      missing,
    });
    return null;
  }

  return {
    publicKey,
    privateKey,
    subject,
  };
}

function compactText(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

function buildPushPayload(input: ExternalReservationPushInput) {
  const displayName = compactText(input.name, 80) || compactText(input.sourceLabel, 80) || 'Solicitud pendiente';
  const time = compactText(input.entryTime, 5);

  return {
    title: 'Nueva solicitud externa',
    body: [`${input.totalPax} pax`, time, displayName].filter(Boolean).join(' \u00b7 '),
    url: `/reservas/grupo/${input.groupEventId}`,
    tag: `external-reservation-${input.groupEventId}`,
  };
}

function getWebPushStatusCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) {
    return null;
  }

  const statusCode = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isInteger(statusCode) ? statusCode : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function getRecipientEmails(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from('app_allowed_users')
    .select('email')
    .eq('is_active', true)
    .eq('notify_external_reservations', true)
    .or('role.eq.admin,can_reservas.eq.true')
    .returns<NotificationRecipientRow[]>();

  if (error) {
    console.error('[notifications/external-reservation-push] Failed to load notification recipients', {
      error,
    });
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((recipient) => recipient.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    ),
  );
}

async function getActiveSubscriptions(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  recipientEmails: string[],
) {
  if (recipientEmails.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('web_push_subscriptions')
    .select('id, user_email, endpoint, p256dh, auth')
    .eq('is_active', true)
    .in('user_email', recipientEmails)
    .returns<WebPushSubscriptionRow[]>();

  if (error) {
    console.error('[notifications/external-reservation-push] Failed to load active push subscriptions', {
      error,
    });
    return [];
  }

  return data ?? [];
}

async function disableInvalidSubscription(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  subscriptionId: string,
) {
  const { error } = await supabase
    .from('web_push_subscriptions')
    .update({
      is_active: false,
      disabled_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  if (error) {
    console.error('[notifications/external-reservation-push] Failed to disable invalid push subscription', {
      subscriptionId,
      error,
    });
  }
}

async function sendNotificationToSubscription(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  subscription: WebPushSubscriptionRow,
  payload: ReturnType<typeof buildPushPayload>,
) {
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );
  } catch (error) {
    const statusCode = getWebPushStatusCode(error);

    if (statusCode && INVALID_SUBSCRIPTION_STATUS_CODES.has(statusCode)) {
      await disableInvalidSubscription(supabase, subscription.id);
      return;
    }

    console.warn('[notifications/external-reservation-push] Failed to send push notification', {
      subscriptionId: subscription.id,
      statusCode,
      message: getErrorMessage(error),
    });
  }
}

export async function sendExternalReservationCreatedPush(input: ExternalReservationPushInput) {
  const vapidConfig = getVapidConfig();

  if (!vapidConfig) {
    return;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const recipientEmails = await getRecipientEmails(supabase);
    const subscriptions = await getActiveSubscriptions(supabase, recipientEmails);

    if (subscriptions.length === 0) {
      return;
    }

    webPush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);

    const payload = buildPushPayload(input);
    await Promise.all(
      subscriptions.map((subscription) => sendNotificationToSubscription(supabase, subscription, payload)),
    );
  } catch (error) {
    console.error('[notifications/external-reservation-push] Unexpected push notification failure', {
      groupEventId: input.groupEventId,
      error,
    });
  }
}
