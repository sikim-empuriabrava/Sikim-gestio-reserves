import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  buildReservationConfirmationEmail,
  normalizeReservationEmailLanguage,
} from './reservationConfirmationEmailTemplate';

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

type ExternalReservationSubmissionRow = {
  id: string;
  preferred_language: string | null;
  confirmation_email_sent_at: string | null;
};

const PROVIDER = 'resend';
const NOT_CONFIGURED_MESSAGE = 'Email provider is not configured';
const INVALID_EMAIL_MESSAGE = 'Missing or invalid customer email.';
const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 8000;
const MAX_TRACKING_ERROR_LENGTH = 240;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeTrackingError(error: unknown) {
  const message = getErrorMessage(error).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const fallback = 'Unknown email provider error';
  const sanitized = message || fallback;

  return sanitized.length > MAX_TRACKING_ERROR_LENGTH
    ? `${sanitized.slice(0, MAX_TRACKING_ERROR_LENGTH - 3)}...`
    : sanitized;
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
  const locationUrl =
    process.env.RESERVATION_EMAIL_LOCATION_URL?.trim() ||
    process.env.RESERVATION_EMAIL_GOOGLE_MAPS_URL?.trim() ||
    null;
  const heroImageUrl = process.env.RESERVATION_EMAIL_HERO_IMAGE_URL?.trim() || null;
  const heroIncludesLogo =
    process.env.RESERVATION_EMAIL_HERO_INCLUDES_LOGO?.trim().toLowerCase() === 'true';
  const logoImageUrl = process.env.RESERVATION_EMAIL_LOGO_IMAGE_URL?.trim() || null;
  const whatsappIconUrl = process.env.RESERVATION_EMAIL_WHATSAPP_ICON_URL?.trim() || null;
  const whatsappHelpIconUrl = process.env.RESERVATION_EMAIL_WHATSAPP_HELP_ICON_URL?.trim() || null;
  const whatsappFooterIconUrl = process.env.RESERVATION_EMAIL_WHATSAPP_FOOTER_ICON_URL?.trim() || null;
  const instagramIconUrl = process.env.RESERVATION_EMAIL_INSTAGRAM_ICON_URL?.trim() || null;
  const facebookIconUrl = process.env.RESERVATION_EMAIL_FACEBOOK_ICON_URL?.trim() || null;

  return {
    enabled,
    apiKey,
    from,
    replyTo,
    locationUrl,
    heroImageUrl,
    heroIncludesLogo,
    logoImageUrl,
    whatsappIconUrl,
    whatsappHelpIconUrl,
    whatsappFooterIconUrl,
    instagramIconUrl,
    facebookIconUrl,
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

async function loadExternalSubmission(supabase: SupabaseAdminClient, groupEventId: string) {
  const { data, error } = await supabase
    .from('external_reservation_submissions')
    .select('id, preferred_language, confirmation_email_sent_at')
    .eq('group_event_id', groupEventId)
    .maybeSingle<ExternalReservationSubmissionRow>();

  if (error) {
    console.error('[customer-notifications] Failed to load external submission', {
      groupEventId,
      error,
    });
    return null;
  }

  return data ?? null;
}

async function updateExternalSubmissionTracking(
  supabase: SupabaseAdminClient,
  submissionId: string,
  patch: {
    attemptedAt: string;
    sentAt?: string | null;
    recipient: string | null;
    language: string;
    providerId: string | null;
    errorMessage: string | null;
  },
) {
  const { error } = await supabase
    .from('external_reservation_submissions')
    .update({
      confirmation_email_sent_at: patch.sentAt ?? null,
      confirmation_email_attempted_at: patch.attemptedAt,
      confirmation_email_to: patch.recipient,
      confirmation_email_language: patch.language,
      confirmation_email_provider: PROVIDER,
      confirmation_email_provider_id: patch.providerId,
      confirmation_email_error: patch.errorMessage,
    })
    .eq('id', submissionId);

  if (error) {
    console.error('[customer-notifications] Failed to update external confirmation email tracking', {
      submissionId,
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
  idempotencyKey: string;
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
        'Idempotency-Key': input.idempotencyKey,
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

    if (reservation.status !== 'confirmed') {
      return;
    }

    const externalSubmission = await loadExternalSubmission(supabase, groupEventId);

    if (!externalSubmission || externalSubmission.confirmation_email_sent_at) {
      return;
    }

    const recipient = normalizeCustomerEmail(reservation.customer_email);
    const language = normalizeReservationEmailLanguage(externalSubmission.preferred_language);
    const attemptedAt = new Date().toISOString();

    if (!isValidCustomerEmail(recipient)) {
      await updateExternalSubmissionTracking(
        supabase,
        externalSubmission.id,
        {
          attemptedAt,
          sentAt: null,
          recipient: recipient || null,
          language,
          providerId: null,
          errorMessage: INVALID_EMAIL_MESSAGE,
        },
      );
      return;
    }

    const config = getEmailConfig();

    if (!config.isConfigured) {
      await updateExternalSubmissionTracking(
        supabase,
        externalSubmission.id,
        {
          attemptedAt,
          sentAt: null,
          recipient,
          language,
          providerId: null,
          errorMessage: NOT_CONFIGURED_MESSAGE,
        },
      );
      return;
    }

    const email = buildReservationConfirmationEmail({
      language,
      customerName: reservation.customer_name,
      eventDate: reservation.event_date,
      entryTime: reservation.entry_time,
      totalPax: getTotalPax(reservation),
      locationUrl: config.locationUrl,
      heroImageUrl: config.heroImageUrl,
      heroIncludesLogo: config.heroIncludesLogo,
      logoImageUrl: config.logoImageUrl,
      whatsappIconUrl: config.whatsappIconUrl,
      whatsappHelpIconUrl: config.whatsappHelpIconUrl,
      whatsappFooterIconUrl: config.whatsappFooterIconUrl,
      instagramIconUrl: config.instagramIconUrl,
      facebookIconUrl: config.facebookIconUrl,
    });

    try {
      const providerMessageId = await sendWithResend({
        apiKey: config.apiKey,
        from: config.from,
        replyTo: config.replyTo,
        recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: `external-reservation-confirmation-${groupEventId}`,
      });
      const sentAt = new Date().toISOString();

      await updateExternalSubmissionTracking(
        supabase,
        externalSubmission.id,
        {
          attemptedAt,
          sentAt,
          recipient,
          language: email.language,
          providerId: providerMessageId,
          errorMessage: null,
        },
      );
    } catch (error) {
      await updateExternalSubmissionTracking(
        supabase,
        externalSubmission.id,
        {
          attemptedAt,
          sentAt: null,
          recipient,
          language: email.language,
          providerId: null,
          errorMessage: sanitizeTrackingError(error),
        },
      );
      console.error('[customer-notifications] Reservation confirmation email failed', {
        groupEventId,
        error,
      });
    }
  } catch (error) {
    console.error('[customer-notifications] Unexpected reservation confirmation email failure', {
      groupEventId,
      error,
    });
  }
}
