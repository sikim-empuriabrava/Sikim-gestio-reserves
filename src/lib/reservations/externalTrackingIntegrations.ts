import 'server-only';

import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const externalTrackingProviders = [
  'meta_pixel',
  'google_tag',
  'google_ads_conversion',
  'google_tag_manager',
] as const;

export const externalTrackingConsentCategories = ['analytics', 'marketing'] as const;
export const externalTrackingTriggerEvents = ['page_view', 'reservation_request_submitted'] as const;

export type ExternalTrackingProvider = (typeof externalTrackingProviders)[number];
export type ExternalTrackingConsentCategory = (typeof externalTrackingConsentCategories)[number];
export type ExternalTrackingTriggerEvent = (typeof externalTrackingTriggerEvents)[number];

export type ExternalTrackingIntegration = {
  id: string;
  provider: ExternalTrackingProvider;
  name: string;
  enabled: boolean;
  consentCategory: ExternalTrackingConsentCategory;
  triggerEvent: ExternalTrackingTriggerEvent;
  metaPixelId: string | null;
  googleTagId: string | null;
  googleAdsConversionId: string | null;
  googleAdsConversionLabel: string | null;
  gtmContainerId: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExternalTrackingIntegrationRow = {
  id: string;
  provider: ExternalTrackingProvider;
  name: string;
  enabled: boolean | null;
  consent_category: ExternalTrackingConsentCategory;
  trigger_event: ExternalTrackingTriggerEvent;
  meta_pixel_id: string | null;
  google_tag_id: string | null;
  google_ads_conversion_id: string | null;
  google_ads_conversion_label: string | null;
  gtm_container_id: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ExternalTrackingIntegrationDbPayload = {
  provider: ExternalTrackingProvider;
  name: string;
  enabled: boolean;
  consent_category: ExternalTrackingConsentCategory;
  trigger_event: ExternalTrackingTriggerEvent;
  meta_pixel_id: string | null;
  google_tag_id: string | null;
  google_ads_conversion_id: string | null;
  google_ads_conversion_label: string | null;
  gtm_container_id: string | null;
  notes: string | null;
};

const payloadSchema = z
  .object({
    provider: z.enum(externalTrackingProviders),
    name: z.string().max(120),
    enabled: z.boolean().optional().default(false),
    consentCategory: z.enum(externalTrackingConsentCategories).optional().default('marketing'),
    triggerEvent: z.enum(externalTrackingTriggerEvents).optional().default('reservation_request_submitted'),
    metaPixelId: z.string().max(64).nullable().optional(),
    googleTagId: z.string().max(80).nullable().optional(),
    googleAdsConversionId: z.string().max(80).nullable().optional(),
    googleAdsConversionLabel: z.string().max(128).nullable().optional(),
    gtmContainerId: z.string().max(80).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();

const META_PIXEL_ID_RE = /^[0-9]{5,32}$/;
const GOOGLE_TAG_ID_RE = /^(G|AW)-[A-Za-z0-9_-]{4,64}$/;
const GOOGLE_ADS_CONVERSION_ID_RE = /^AW-[A-Za-z0-9_-]{4,64}$/;
const GTM_CONTAINER_ID_RE = /^GTM-[A-Za-z0-9_-]{4,64}$/;

function normalizeOptionalText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function containsUnsafeScriptText(value: string | null) {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return lowered.includes('<script') || lowered.includes('javascript:');
}

function hasAnyValue(values: Array<string | null>) {
  return values.some((value) => value !== null);
}

function mapExternalTrackingIntegration(row: ExternalTrackingIntegrationRow): ExternalTrackingIntegration {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    enabled: Boolean(row.enabled),
    consentCategory: row.consent_category,
    triggerEvent: row.trigger_event,
    metaPixelId: row.meta_pixel_id,
    googleTagId: row.google_tag_id,
    googleAdsConversionId: row.google_ads_conversion_id,
    googleAdsConversionLabel: row.google_ads_conversion_label,
    gtmContainerId: row.gtm_container_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateExternalTrackingIntegrationPayload(
  input: unknown,
): { success: true; data: ExternalTrackingIntegrationDbPayload } | { success: false; error: string } {
  const parsed = payloadSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: 'Configuracion de tracking invalida.' };
  }

  const payload = parsed.data;
  const name = payload.name.trim();
  const metaPixelId = normalizeOptionalText(payload.metaPixelId);
  const googleTagId = normalizeOptionalText(payload.googleTagId);
  const googleAdsConversionId = normalizeOptionalText(payload.googleAdsConversionId);
  const googleAdsConversionLabel = normalizeOptionalText(payload.googleAdsConversionLabel);
  const gtmContainerId = normalizeOptionalText(payload.gtmContainerId);
  const notes = normalizeOptionalText(payload.notes);

  if (!name) {
    return { success: false, error: 'El nombre interno es obligatorio.' };
  }

  if (
    [
      name,
      metaPixelId,
      googleTagId,
      googleAdsConversionId,
      googleAdsConversionLabel,
      gtmContainerId,
      notes,
    ].some(containsUnsafeScriptText)
  ) {
    return { success: false, error: 'Solo se permiten IDs estructurados, no scripts ni codigo.' };
  }

  const base: ExternalTrackingIntegrationDbPayload = {
    provider: payload.provider,
    name,
    enabled: payload.enabled,
    consent_category: payload.consentCategory,
    trigger_event: payload.triggerEvent,
    meta_pixel_id: null,
    google_tag_id: null,
    google_ads_conversion_id: null,
    google_ads_conversion_label: null,
    gtm_container_id: null,
    notes,
  };

  if (payload.provider === 'meta_pixel') {
    if (!metaPixelId) {
      return { success: false, error: 'El Meta Pixel ID es obligatorio.' };
    }

    if (!META_PIXEL_ID_RE.test(metaPixelId)) {
      return { success: false, error: 'El Meta Pixel ID debe contener solo digitos.' };
    }

    if (hasAnyValue([googleTagId, googleAdsConversionId, googleAdsConversionLabel, gtmContainerId])) {
      return { success: false, error: 'Meta Pixel no puede incluir campos de Google o GTM.' };
    }

    return {
      success: true,
      data: {
        ...base,
        consent_category: 'marketing',
        meta_pixel_id: metaPixelId,
      },
    };
  }

  if (payload.provider === 'google_tag') {
    if (!googleTagId) {
      return { success: false, error: 'El Google Tag ID es obligatorio.' };
    }

    if (!GOOGLE_TAG_ID_RE.test(googleTagId)) {
      return { success: false, error: 'El Google Tag ID debe empezar por G- o AW-.' };
    }

    if (hasAnyValue([metaPixelId, googleAdsConversionId, googleAdsConversionLabel, gtmContainerId])) {
      return { success: false, error: 'Google Tag no puede incluir campos de Meta, Ads Conversion o GTM.' };
    }

    return {
      success: true,
      data: {
        ...base,
        google_tag_id: googleTagId,
      },
    };
  }

  if (payload.provider === 'google_ads_conversion') {
    if (!googleAdsConversionId) {
      return { success: false, error: 'El Google Ads Conversion ID es obligatorio.' };
    }

    if (!googleAdsConversionLabel) {
      return { success: false, error: 'El Google Ads Conversion Label es obligatorio.' };
    }

    if (!GOOGLE_ADS_CONVERSION_ID_RE.test(googleAdsConversionId)) {
      return { success: false, error: 'El Google Ads Conversion ID debe empezar por AW-.' };
    }

    if (hasAnyValue([metaPixelId, googleTagId, gtmContainerId])) {
      return { success: false, error: 'Google Ads Conversion no puede incluir campos de Meta, Google Tag o GTM.' };
    }

    return {
      success: true,
      data: {
        ...base,
        consent_category: 'marketing',
        google_ads_conversion_id: googleAdsConversionId,
        google_ads_conversion_label: googleAdsConversionLabel,
      },
    };
  }

  if (!gtmContainerId) {
    return { success: false, error: 'El GTM Container ID es obligatorio.' };
  }

  if (!GTM_CONTAINER_ID_RE.test(gtmContainerId)) {
    return { success: false, error: 'El GTM Container ID debe empezar por GTM-.' };
  }

  if (hasAnyValue([metaPixelId, googleTagId, googleAdsConversionId, googleAdsConversionLabel])) {
    return { success: false, error: 'Google Tag Manager no puede incluir campos de Meta, Google Tag o Ads Conversion.' };
  }

  return {
    success: true,
    data: {
      ...base,
      gtm_container_id: gtmContainerId,
    },
  };
}

export async function loadExternalTrackingIntegrations(): Promise<ExternalTrackingIntegration[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_tracking_integrations')
    .select(
      'id, provider, name, enabled, consent_category, trigger_event, meta_pixel_id, google_tag_id, google_ads_conversion_id, google_ads_conversion_label, gtm_container_id, notes, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ExternalTrackingIntegrationRow[]).map(mapExternalTrackingIntegration);
}

export function toExternalTrackingIntegration(row: ExternalTrackingIntegrationRow): ExternalTrackingIntegration {
  return mapExternalTrackingIntegration(row);
}
