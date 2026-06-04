import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

const providers = ['meta_pixel', 'google_tag', 'google_ads_conversion', 'google_tag_manager'] as const;
const consentCategories = ['analytics', 'marketing'] as const;
const triggerEvents = ['page_view', 'reservation_request_submitted'] as const;

type Provider = (typeof providers)[number];
type ConsentCategory = (typeof consentCategories)[number];
type TriggerEvent = (typeof triggerEvents)[number];

type ExternalTrackingConfigRow = {
  provider: string | null;
  consent_category: string | null;
  trigger_event: string | null;
  meta_pixel_id: string | null;
  google_tag_id: string | null;
  google_ads_conversion_id: string | null;
  google_ads_conversion_label: string | null;
  gtm_container_id: string | null;
};

type PublicTrackingIntegration = {
  provider: Provider;
  consentCategory: ConsentCategory;
  triggerEvent: TriggerEvent;
  metaPixelId?: string;
  googleTagId?: string;
  googleAdsConversionId?: string;
  googleAdsConversionLabel?: string;
  gtmContainerId?: string;
};

const providerSet = new Set<string>(providers);
const consentCategorySet = new Set<string>(consentCategories);
const triggerEventSet = new Set<string>(triggerEvents);

const metaPixelIdPattern = /^[0-9]{5,32}$/;
const googleTagIdPattern = /^(G|AW)-[A-Za-z0-9_-]{4,64}$/;
const googleAdsConversionIdPattern = /^AW-[A-Za-z0-9_-]{4,64}$/;
const googleAdsConversionLabelPattern = /^[A-Za-z0-9_-]{1,128}$/;
const gtmContainerIdPattern = /^GTM-[A-Za-z0-9_-]{4,64}$/;

function respond(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...noStoreHeaders,
      ...(init?.headers ?? {}),
    },
  });
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

function normalizeOptionalId(value: string | null) {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isProvider(value: string | null): value is Provider {
  return typeof value === 'string' && providerSet.has(value);
}

function isConsentCategory(value: string | null): value is ConsentCategory {
  return typeof value === 'string' && consentCategorySet.has(value);
}

function isTriggerEvent(value: string | null): value is TriggerEvent {
  return typeof value === 'string' && triggerEventSet.has(value);
}

function warnInvalidIntegration(row: ExternalTrackingConfigRow, reason: string) {
  console.warn('[api/external-tracking-config] Skipping invalid tracking integration', {
    provider: row.provider,
    consentCategory: row.consent_category,
    triggerEvent: row.trigger_event,
    reason,
  });
}

function toPublicTrackingIntegration(row: ExternalTrackingConfigRow): PublicTrackingIntegration | null {
  if (!isProvider(row.provider)) {
    warnInvalidIntegration(row, 'unknown_provider');
    return null;
  }

  if (!isConsentCategory(row.consent_category)) {
    warnInvalidIntegration(row, 'unknown_consent_category');
    return null;
  }

  if (!isTriggerEvent(row.trigger_event)) {
    warnInvalidIntegration(row, 'unknown_trigger_event');
    return null;
  }

  const base = {
    provider: row.provider,
    consentCategory: row.consent_category,
    triggerEvent: row.trigger_event,
  };

  if (row.provider === 'meta_pixel') {
    const metaPixelId = normalizeOptionalId(row.meta_pixel_id);
    if (!metaPixelId || !metaPixelIdPattern.test(metaPixelId)) {
      warnInvalidIntegration(row, 'invalid_meta_pixel_id');
      return null;
    }

    return { ...base, metaPixelId };
  }

  if (row.provider === 'google_tag') {
    const googleTagId = normalizeOptionalId(row.google_tag_id);
    if (!googleTagId || !googleTagIdPattern.test(googleTagId)) {
      warnInvalidIntegration(row, 'invalid_google_tag_id');
      return null;
    }

    return { ...base, googleTagId };
  }

  if (row.provider === 'google_ads_conversion') {
    const googleAdsConversionId = normalizeOptionalId(row.google_ads_conversion_id);
    const googleAdsConversionLabel = normalizeOptionalId(row.google_ads_conversion_label);

    if (!googleAdsConversionId || !googleAdsConversionIdPattern.test(googleAdsConversionId)) {
      warnInvalidIntegration(row, 'invalid_google_ads_conversion_id');
      return null;
    }

    if (!googleAdsConversionLabel || !googleAdsConversionLabelPattern.test(googleAdsConversionLabel)) {
      warnInvalidIntegration(row, 'invalid_google_ads_conversion_label');
      return null;
    }

    return { ...base, googleAdsConversionId, googleAdsConversionLabel };
  }

  const gtmContainerId = normalizeOptionalId(row.gtm_container_id);
  if (!gtmContainerId || !gtmContainerIdPattern.test(gtmContainerId)) {
    warnInvalidIntegration(row, 'invalid_gtm_container_id');
    return null;
  }

  return { ...base, gtmContainerId };
}

export async function GET(request: NextRequest) {
  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    return respond({ error: 'Unauthorized' }, { status: 401 });
  }

  const configSecret = process.env.SIKIM_PUBLIC_TRACKING_CONFIG_SECRET?.trim();

  if (!configSecret) {
    console.error('[api/external-tracking-config] Missing tracking config secret');
    return respond({ error: 'Configuration error' }, { status: 500 });
  }

  if (!tokensMatch(configSecret, bearerToken)) {
    return respond({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('external_tracking_integrations')
      .select(
        'provider, consent_category, trigger_event, meta_pixel_id, google_tag_id, google_ads_conversion_id, google_ads_conversion_label, gtm_container_id',
      )
      .eq('enabled', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[api/external-tracking-config] Failed to load tracking integrations', error);
      return respond({ error: 'Configuration error' }, { status: 500 });
    }

    const integrations = ((data ?? []) as ExternalTrackingConfigRow[])
      .map(toPublicTrackingIntegration)
      .filter((integration): integration is PublicTrackingIntegration => integration !== null);

    return respond({ ok: true, integrations });
  } catch (error) {
    console.error('[api/external-tracking-config] Unexpected tracking config failure', error);
    return respond({ error: 'Configuration error' }, { status: 500 });
  }
}
