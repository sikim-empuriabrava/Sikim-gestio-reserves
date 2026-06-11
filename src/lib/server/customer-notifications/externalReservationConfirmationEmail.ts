import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { buildReservationConfirmationEmail } from './reservationConfirmationEmailTemplate';

type SupabaseAdminClient = SupabaseClient;

type GroupEventRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  event_date: string | null;
  entry_time: string | null;
  adults: number | null;
  children: number | null;
  total_pax: number | null;
  status: string | null;
};

type NotificationRow = {
  id: string;
  status: string;
};

type NotificationStatus = 'pending' | 'sent' | 'skipped' | 'failed' | 'provider_not_configured';

const CHANNEL = 'email';
const NOTIFICATION_TYPE = 'reservation_confirmed';
const PROVIDER = 'resend';
const NOT_CONFIGURED_MESSAGE = 'Email provider is not configured';
const INVALID_EMAIL_MESSAGE = 'Missing or invalid customer email.';
const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 8000;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

export function normalizeCustomerEmail(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidCustomerEmail(value: unknown) {
  const email = normalizeCustomerEmail(value);
  const atIndex = email.indexOf('@');

  if (email.length < 5 || email.length > 320 || /\s/.test(email)) {
    return false;
  }

  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) {
    return false;
  }

  const domain = email.slice(atIndex + 1);
  const dotIndex = domain.indexOf('.');

  return dotIndex > 0 && dotIndex < domain.length - 1;
}

function getTotalPax(reservation: GroupEventRow) {
  if (typeof reservation.total_pax === 'number' && reservation.total_pax > 0) {
    return reservation.total_pax;
  }

  const adults = typeof reservation.adults === 'number' ? reservation.adults : 0;
  const children = typeof reservation.children === 'number' ? reservation.children : 0;
  const total = adults + children;

  return total > 0 ? total : null;
}

function getEmailConfig() {
  const enabled = process.env.RESERVATION_EMAIL_CONFIRMATIONS_ENABLED?.trim().toLowerCase() === 'true';
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  const from = process.env.RESERVATION_EMAIL_FROM?.trim() ?? '';
  const replyTo = process.env.RESERVATION_EMAIL_REPLY_TO?.trim() || null;
  const googleMapsUrl = process.env.RESERVATION_EMAIL_GOOGLE_MAPS_URL?.trim() || null;

  return {
    enabled,
    apiKey,
    from,
    replyTo,
    googleMapsUrl,
    isConfigured: enabled && Boolean(apiKey) && Boolean(from),
  };
}

async function loadReservation(supabase: SupabaseAdminClient, groupEventId: string) {
  const { data, error } = await supabase
    .from('group_events')
    .select('id, customer_name, customer_email, event_date, entry_time, adults, children, total_pax, status')
    .eq('id', groupEventId)
    .maybeSingle<GroupEventRow>();

  if (error) {
    console.error('[customer-notifications] Failed to load group event', {
      groupEventId,
      error,
    });
    return null;
  }

  return data ?? null;
}

async function isExternalReservation(supabase: SupabaseAdminClient, groupEventId: string) {
  const { data, error } = await supabase
    .from('external_reservation_submissions')
    .select('id')
    .eq('group_event_id', groupEventId)
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error('[customer-notifications] Failed to verify external submission', {
      groupEventId,
      error,
    });
    return false;
  }

  return Boolean(data);
}

async function getExistingNotification(supabase: SupabaseAdminClient, groupEventId: string) {
  const { data, error } = await supabase
    .from('customer_reservation_notifications')
    .select('id, status')
    .eq('group_event_id', groupEventId)
    .eq('channel', CHANNEL)
    .eq('notification_type', NOTIFICATION_TYPE)
    .maybeSingle<NotificationRow>();

  if (error) {
    console.error('[customer-notifications] Failed to load existing notification', {
      groupEventId,
      error,
    });
    return null;
  }

  return data ?? null;
}

async function upsertNonSendingNotification(
  supabase: SupabaseAdminClient,
  reservation: GroupEventRow,
  recipient: string,
  status: Exclude<NotificationStatus, 'pending' | 'sent' | 'failed'>,
  errorMessage: string,
) {
  const email = buildReservationConfirmationEmail({
    customerName: reservation.customer_name,
    eventDate: reservation.event_date,
    entryTime: reservation.entry_time,
    totalPax: getTotalPax(reservation),
    googleMapsUrl: getEmailConfig().googleMapsUrl,
  });

  const { error } = await supabase
    .from('customer_reservation_notifications')
    .upsert(
      {
        group_event_id: reservation.id,
        channel: CHANNEL,
        notification_type: NOTIFICATION_TYPE,
        recipient,
        recipient_name_snapshot: reservation.customer_name,
        status,
        provider: PROVIDER,
        provider_message_id: null,
        subject_snapshot: email.subject,
        body_text_snapshot: email.text,
        payload_snapshot: {
          eventDate: reservation.event_date,
          entryTime: reservation.entry_time,
          totalPax: getTotalPax(reservation),
        },
        error_message: errorMessage,
        sent_at: null,
      },
      { onConflict: 'group_event_id,channel,notification_type' },
    );

  if (error) {
    console.error('[customer-notifications] Failed to upsert non-sending notification', {
      groupEventId: reservation.id,
      status,
      error,
    });
  }
}

async function createPendingNotification(
  supabase: SupabaseAdminClient,
  reservation: GroupEventRow,
  recipient: string,
  subject: string,
  bodyText: string,
) {
  const { data, error } = await supabase
    .from('customer_reservation_notifications')
    .insert({
      group_event_id: reservation.id,
      channel: CHANNEL,
      notification_type: NOTIFICATION_TYPE,
      recipient,
      recipient_name_snapshot: reservation.customer_name,
      status: 'pending',
      provider: PROVIDER,
      provider_message_id: null,
      subject_snapshot: subject,
      body_text_snapshot: bodyText,
      payload_snapshot: {
        eventDate: reservation.event_date,
        entryTime: reservation.entry_time,
        totalPax: getTotalPax(reservation),
      },
      error_message: null,
      sent_at: null,
    })
    .select('id, status')
    .single<NotificationRow>();

  if (error?.code === '23505') {
    return null;
  }

  if (error) {
    console.error('[customer-notifications] Failed to create pending notification', {
      groupEventId: reservation.id,
      error,
    });
    return null;
  }

  return data;
}

async function markNotification(
  supabase: SupabaseAdminClient,
  notificationId: string,
  patch: {
    status: Exclude<NotificationStatus, 'pending' | 'skipped' | 'provider_not_configured'>;
    providerMessageId?: string | null;
    errorMessage?: string | null;
  },
) {
  const { error } = await supabase
    .from('customer_reservation_notifications')
    .update({
      status: patch.status,
      provider_message_id: patch.providerMessageId ?? null,
      error_message: patch.errorMessage ?? null,
      sent_at: patch.status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', notificationId);

  if (error) {
    console.error('[customer-notifications] Failed to update notification status', {
      notificationId,
      status: patch.status,
      error,
    });
  }
}

async function sendWithResend(input: {
  apiKey: string;
  from: string;
  replyTo: string | null;
  recipient: string;
  subject: string;
  html: string;
  text: string;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(RESEND_EMAILS_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.recipient],
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Resend request timed out after ${RESEND_TIMEOUT_MS} ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = (await response.json().catch(() => null)) as { id?: unknown; message?: unknown } | null;

  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : `Resend returned ${response.status}`;
    throw new Error(message);
  }

  return typeof payload?.id === 'string' ? payload.id : null;
}

export async function sendExternalReservationConfirmationEmail(
  groupEventId: string,
  supabase: SupabaseAdminClient = createSupabaseAdminClient(),
) {
  try {
    const reservation = await loadReservation(supabase, groupEventId);

    if (!reservation) {
      return;
    }

    if (!(await isExternalReservation(supabase, groupEventId))) {
      return;
    }

    const existingNotification = await getExistingNotification(supabase, groupEventId);

    if (existingNotification?.status === 'sent') {
      return;
    }

    const recipient = normalizeCustomerEmail(reservation.customer_email);

    if (!isValidCustomerEmail(recipient)) {
      await upsertNonSendingNotification(
        supabase,
        reservation,
        recipient || 'missing',
        'skipped',
        INVALID_EMAIL_MESSAGE,
      );
      return;
    }

    const config = getEmailConfig();
    const email = buildReservationConfirmationEmail({
      customerName: reservation.customer_name,
      eventDate: reservation.event_date,
      entryTime: reservation.entry_time,
      totalPax: getTotalPax(reservation),
      googleMapsUrl: config.googleMapsUrl,
    });

    if (!config.isConfigured) {
      await upsertNonSendingNotification(
        supabase,
        reservation,
        recipient,
        'provider_not_configured',
        NOT_CONFIGURED_MESSAGE,
      );
      return;
    }

    if (existingNotification) {
      return;
    }

    const pendingNotification = await createPendingNotification(
      supabase,
      reservation,
      recipient,
      email.subject,
      email.text,
    );

    if (!pendingNotification) {
      return;
    }

    try {
      const providerMessageId = await sendWithResend({
        apiKey: config.apiKey,
        from: config.from,
        replyTo: config.replyTo,
        recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      await markNotification(supabase, pendingNotification.id, {
        status: 'sent',
        providerMessageId,
      });
    } catch (error) {
      await markNotification(supabase, pendingNotification.id, {
        status: 'failed',
        errorMessage: getErrorMessage(error),
      });
    }
  } catch (error) {
    console.error('[customer-notifications] Unexpected reservation confirmation email failure', {
      groupEventId,
      error,
    });
  }
}
