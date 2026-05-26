import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { linkGroupEventCustomerFromSnapshot } from '@/lib/crm/customerLinking';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

const SUPPORTED_LANGUAGES = ['ca', 'es', 'fr', 'en', 'de', 'nl', 'it'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const noStoreHeaders = { 'Cache-Control': 'no-store' };

function respond(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...noStoreHeaders,
      ...(init?.headers ?? {}),
    },
  });
}

function normalizePlainText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(CONTROL_CHARS_PATTERN, '').trim();
}

function normalizeSingleLineText(value: string) {
  return normalizePlainText(value).replace(/\s+/g, ' ');
}

function requiredText(
  label: string,
  min: number,
  max: number,
  normalizer: (value: string) => string = normalizeSingleLineText,
) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? normalizer(value) : value),
    z
      .string({
        required_error: `${label} is required`,
        invalid_type_error: `${label} must be a string`,
      })
      .min(min, `${label} must be between ${min} and ${max} characters`)
      .max(max, `${label} must be between ${min} and ${max} characters`),
  );
}

function optionalText(
  label: string,
  max: number,
  normalizer: (value: string) => string = normalizeSingleLineText,
) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const normalized = normalizer(value);
      return normalized.length > 0 ? normalized : null;
    },
    z
      .string({
        invalid_type_error: `${label} must be a string`,
      })
      .max(max, `${label} must be at most ${max} characters`)
      .nullable(),
  );
}

function optionalEmail(label: string) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const normalized = normalizeSingleLineText(value);
      return normalized.length > 0 ? normalized : null;
    },
    z
      .string({
        invalid_type_error: `${label} must be a string`,
      })
      .max(320, `${label} must be at most 320 characters`)
      .email(`${label} must be a valid email`)
      .nullable(),
  );
}

function optionalLanguage(label: string) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const normalized = normalizeSingleLineText(value).toLowerCase();
      return normalized.length > 0 ? normalized : null;
    },
    z.enum(SUPPORTED_LANGUAGES, { invalid_type_error: `${label} must be a string` }).nullable(),
  );
}

function isValidIsoDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearString, monthString, dayString] = value.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/.exec(authorization);
  return match ? match[1] : null;
}

function tokensMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function formatValidationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'body',
    message: issue.message,
  }));
}

const externalReservationRequestSchema = z
  .object({
    date: requiredText('date', 10, 10).refine((value) => DATE_PATTERN.test(value), {
      message: 'date must use YYYY-MM-DD',
    }).refine(isValidIsoDate, {
      message: 'date must be a valid calendar date',
    }),
    time: requiredText('time', 5, 5).refine((value) => TIME_PATTERN.test(value), {
      message: 'time must use HH:mm',
    }),
    partySize: z
      .number({
        required_error: 'partySize is required',
        invalid_type_error: 'partySize must be a number',
      })
      .int('partySize must be an integer')
      .min(1, 'partySize must be between 1 and 80')
      .max(80, 'partySize must be between 1 and 80'),
    contactName: requiredText('contactName', 2, 120),
    phone: requiredText('phone', 6, 30),
    email: optionalEmail('email'),
    comment: optionalText('comment', 1000, normalizePlainText),
    privacyAccepted: z.literal(true, {
      errorMap: () => ({ message: 'privacyAccepted must be true' }),
    }),
    preferredLanguage: optionalLanguage('preferredLanguage'),
    attribution: z.preprocess(
      (value) => (value === null || value === undefined ? {} : value),
      z
        .object({
          sourceLabel: optionalText('attribution.sourceLabel', 120),
          utmSource: optionalText('attribution.utmSource', 160),
          utmMedium: optionalText('attribution.utmMedium', 160),
          utmCampaign: optionalText('attribution.utmCampaign', 160),
          utmContent: optionalText('attribution.utmContent', 200),
          utmTerm: optionalText('attribution.utmTerm', 200),
          referrer: optionalText('attribution.referrer', 1000),
          landingPage: optionalText('attribution.landingPage', 1000),
          fbclid: optionalText('attribution.fbclid', 255),
          gclid: optionalText('attribution.gclid', 255),
          ttclid: optionalText('attribution.ttclid', 255),
          userAgent: optionalText('attribution.userAgent', 1000),
          ipHash: optionalText('attribution.ipHash', 255),
        })
        .strict(),
    ),
  })
  .strict();

type ExternalReservationRequest = z.infer<typeof externalReservationRequestSchema>;

type ExternalReservationSettingsRow = {
  is_enabled: boolean;
  default_offering_kind: 'cheffing_card' | 'cheffing_menu' | null;
  default_cheffing_card_id: string | null;
  default_cheffing_menu_id: string | null;
};

type ActiveCheffingCardRow = {
  id: string;
  name: string;
};

type ActiveCheffingMenuRow = {
  id: string;
  name: string;
  price_per_person: number | string | null;
};

type GroupEventOfferingInsert = {
  group_event_id: string;
  offering_kind: 'cheffing_card' | 'cheffing_menu';
  cheffing_menu_id: string | null;
  cheffing_card_id: string | null;
  assigned_pax: number;
  display_name_snapshot: string;
  unit_price_snapshot: number | string | null;
  notes: string | null;
  sort_order: number;
  snapshot_payload: {
    source: 'external_reservation_settings';
    appliedBy: 'external_reservation_ingest';
  };
};

function buildGroupEventInsert(payload: ExternalReservationRequest) {
  return {
    name: payload.contactName,
    event_date: payload.date,
    entry_time: payload.time,
    adults: payload.partySize,
    children: 0,
    status: 'pending',
    event_mode: 'dinner',
    customer_name: payload.contactName,
    customer_phone: payload.phone,
    customer_email: payload.email,
    extras: payload.comment,
  };
}

function buildExternalSubmissionInsert(groupEventId: string, payload: ExternalReservationRequest, nowIso: string) {
  return {
    group_event_id: groupEventId,
    source_label: payload.attribution.sourceLabel ?? 'Direct / Unknown',
    utm_source: payload.attribution.utmSource,
    utm_medium: payload.attribution.utmMedium,
    utm_campaign: payload.attribution.utmCampaign,
    utm_content: payload.attribution.utmContent,
    utm_term: payload.attribution.utmTerm,
    referrer: payload.attribution.referrer,
    landing_page: payload.attribution.landingPage,
    fbclid: payload.attribution.fbclid,
    gclid: payload.attribution.gclid,
    ttclid: payload.attribution.ttclid,
    preferred_language: payload.preferredLanguage,
    privacy_accepted_at: nowIso,
    marketing_consent: false,
    marketing_consent_at: null,
    marketing_consent_source: null,
    ip_hash: payload.attribution.ipHash,
    user_agent: payload.attribution.userAgent,
    submitted_at: nowIso,
  };
}

async function buildDefaultOfferingInsert(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  groupEventId: string,
  payload: ExternalReservationRequest,
): Promise<GroupEventOfferingInsert | null> {
  const { data: settingsData, error: settingsError } = await supabase
    .from('external_reservation_settings')
    .select('is_enabled, default_offering_kind, default_cheffing_card_id, default_cheffing_menu_id')
    .eq('id', true)
    .maybeSingle();

  if (settingsError) {
    console.error('[API] external-reservation-requests default offering settings lookup failed', {
      groupEventId,
      error: settingsError,
    });
    return null;
  }

  const settings = (settingsData ?? null) as ExternalReservationSettingsRow | null;

  if (!settings || !settings.is_enabled) {
    return null;
  }

  if (settings.default_offering_kind === 'cheffing_card') {
    if (!settings.default_cheffing_card_id) {
      console.warn('[API] external-reservation-requests enabled default card setting is missing card id', {
        groupEventId,
      });
      return null;
    }

    const { data: cardData, error: cardError } = await supabase
      .from('cheffing_cards')
      .select('id, name')
      .eq('id', settings.default_cheffing_card_id)
      .eq('is_active', true)
      .maybeSingle();

    if (cardError) {
      console.error('[API] external-reservation-requests default cheffing card lookup failed', {
        groupEventId,
        cheffingCardId: settings.default_cheffing_card_id,
        error: cardError,
      });
      return null;
    }

    const card = (cardData ?? null) as ActiveCheffingCardRow | null;

    if (!card) {
      console.warn('[API] external-reservation-requests configured default cheffing card is missing or inactive', {
        groupEventId,
        cheffingCardId: settings.default_cheffing_card_id,
      });
      return null;
    }

    return {
      group_event_id: groupEventId,
      offering_kind: 'cheffing_card',
      cheffing_menu_id: null,
      cheffing_card_id: card.id,
      assigned_pax: payload.partySize,
      display_name_snapshot: card.name,
      unit_price_snapshot: null,
      notes: null,
      sort_order: 0,
      snapshot_payload: {
        source: 'external_reservation_settings',
        appliedBy: 'external_reservation_ingest',
      },
    };
  }

  if (settings.default_offering_kind === 'cheffing_menu') {
    if (!settings.default_cheffing_menu_id) {
      console.warn('[API] external-reservation-requests enabled default menu setting is missing menu id', {
        groupEventId,
      });
      return null;
    }

    const { data: menuData, error: menuError } = await supabase
      .from('cheffing_menus')
      .select('id, name, price_per_person')
      .eq('id', settings.default_cheffing_menu_id)
      .eq('is_active', true)
      .maybeSingle();

    if (menuError) {
      console.error('[API] external-reservation-requests default cheffing menu lookup failed', {
        groupEventId,
        cheffingMenuId: settings.default_cheffing_menu_id,
        error: menuError,
      });
      return null;
    }

    const menu = (menuData ?? null) as ActiveCheffingMenuRow | null;

    if (!menu) {
      console.warn('[API] external-reservation-requests configured default cheffing menu is missing or inactive', {
        groupEventId,
        cheffingMenuId: settings.default_cheffing_menu_id,
      });
      return null;
    }

    return {
      group_event_id: groupEventId,
      offering_kind: 'cheffing_menu',
      cheffing_menu_id: menu.id,
      cheffing_card_id: null,
      assigned_pax: payload.partySize,
      display_name_snapshot: menu.name,
      unit_price_snapshot: menu.price_per_person,
      notes: null,
      sort_order: 0,
      snapshot_payload: {
        source: 'external_reservation_settings',
        appliedBy: 'external_reservation_ingest',
      },
    };
  }

  console.warn('[API] external-reservation-requests enabled default offering settings are incomplete or invalid', {
    groupEventId,
    defaultOfferingKind: settings.default_offering_kind,
    hasCardId: Boolean(settings.default_cheffing_card_id),
    hasMenuId: Boolean(settings.default_cheffing_menu_id),
  });
  return null;
}

async function applyDefaultOfferingToExternalReservation(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  groupEventId: string,
  payload: ExternalReservationRequest,
) {
  try {
    const offeringInsert = await buildDefaultOfferingInsert(supabase, groupEventId, payload);

    if (!offeringInsert) {
      return;
    }

    const { error: offeringError } = await supabase
      .from('group_event_offerings')
      .insert(offeringInsert);

    if (offeringError) {
      console.error('[API] external-reservation-requests automatic offering insert failed', {
        groupEventId,
        offeringKind: offeringInsert.offering_kind,
        error: offeringError,
      });
    }
  } catch (error) {
    console.error('[API] external-reservation-requests automatic offering assignment threw unexpectedly', {
      groupEventId,
      error,
    });
  }
}

export async function POST(request: NextRequest) {
  const ingestSecret = process.env.SIKIM_PUBLIC_RESERVATION_INGEST_SECRET?.trim();

  if (!ingestSecret) {
    console.error('[API] external-reservation-requests missing ingest secret');
    return respond({ error: 'Configuration error' }, { status: 500, headers: noStoreHeaders });
  }

  const bearerToken = getBearerToken(request);
  if (!bearerToken || !tokensMatch(ingestSecret, bearerToken)) {
    return respond({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return respond({ error: 'Invalid JSON payload' }, { status: 400, headers: noStoreHeaders });
  }

  const parsedPayload = externalReservationRequestSchema.safeParse(body);
  if (!parsedPayload.success) {
    return respond(
      {
        error: 'Invalid payload',
        issues: formatValidationIssues(parsedPayload.error),
      },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const payload = parsedPayload.data;
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  try {
    const { data: groupEvent, error: groupEventError } = await supabase
      .from('group_events')
      .insert(buildGroupEventInsert(payload))
      .select('id, status')
      .single<{ id: string; status: string }>();

    if (groupEventError || !groupEvent) {
      console.error('[API] external-reservation-requests group event insert failed', groupEventError);
      return respond({ error: 'Unable to create external reservation request' }, { status: 500, headers: noStoreHeaders });
    }

    const groupEventId = groupEvent.id;
    const { error: submissionError } = await supabase
      .from('external_reservation_submissions')
      .insert(buildExternalSubmissionInsert(groupEventId, payload, nowIso));

    if (submissionError) {
      console.error('[API] external-reservation-requests external submission insert failed', {
        groupEventId,
        error: submissionError,
      });

      const { error: cleanupError } = await supabase.from('group_events').delete().eq('id', groupEventId);
      if (cleanupError) {
        console.error('[API] external-reservation-requests orphan cleanup failed', {
          groupEventId,
          error: cleanupError,
        });
      }

      return respond({ error: 'Unable to create external reservation request' }, { status: 500, headers: noStoreHeaders });
    }

    await applyDefaultOfferingToExternalReservation(supabase, groupEventId, payload);

    try {
      await linkGroupEventCustomerFromSnapshot(
        groupEventId,
        {
          customer_name: payload.contactName,
          customer_phone: payload.phone,
          customer_email: payload.email,
        },
        supabase,
      );
    } catch (crmError) {
      console.error('[API] external-reservation-requests CRM link failed', {
        groupEventId,
        error: crmError,
      });
    }

    return respond(
      {
        ok: true,
        groupEventId,
        status: groupEvent.status,
      },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    console.error('[API] external-reservation-requests unexpected error', error);
    return respond({ error: 'Unable to create external reservation request' }, { status: 500, headers: noStoreHeaders });
  }
}
