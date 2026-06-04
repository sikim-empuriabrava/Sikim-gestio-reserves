create table if not exists public.external_tracking_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  name text not null,
  enabled boolean not null default false,
  consent_category text not null default 'marketing',
  trigger_event text not null default 'reservation_request_submitted',
  meta_pixel_id text null,
  google_tag_id text null,
  google_ads_conversion_id text null,
  google_ads_conversion_label text null,
  gtm_container_id text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_tracking_integrations_name_not_empty_chk
    check (btrim(name) <> '' and length(btrim(name)) <= 120),
  constraint external_tracking_integrations_provider_chk
    check (provider in ('meta_pixel', 'google_tag', 'google_ads_conversion', 'google_tag_manager')),
  constraint external_tracking_integrations_consent_category_chk
    check (consent_category in ('analytics', 'marketing')),
  constraint external_tracking_integrations_trigger_event_chk
    check (trigger_event in ('page_view', 'reservation_request_submitted')),
  constraint external_tracking_integrations_text_lengths_chk
    check (
      (meta_pixel_id is null or length(meta_pixel_id) <= 64)
      and (google_tag_id is null or length(google_tag_id) <= 80)
      and (google_ads_conversion_id is null or length(google_ads_conversion_id) <= 80)
      and (
        google_ads_conversion_label is null
        or (btrim(google_ads_conversion_label) <> '' and length(google_ads_conversion_label) <= 128)
      )
      and (gtm_container_id is null or length(gtm_container_id) <= 80)
      and (notes is null or length(notes) <= 1000)
    ),
  constraint external_tracking_integrations_no_script_text_chk
    check (
      position(
        '<script' in lower(
          name
          || coalesce(meta_pixel_id, '')
          || coalesce(google_tag_id, '')
          || coalesce(google_ads_conversion_id, '')
          || coalesce(google_ads_conversion_label, '')
          || coalesce(gtm_container_id, '')
          || coalesce(notes, '')
        )
      ) = 0
      and position(
        'javascript:' in lower(
          name
          || coalesce(meta_pixel_id, '')
          || coalesce(google_tag_id, '')
          || coalesce(google_ads_conversion_id, '')
          || coalesce(google_ads_conversion_label, '')
          || coalesce(gtm_container_id, '')
          || coalesce(notes, '')
        )
      ) = 0
    ),
  constraint external_tracking_integrations_meta_pixel_id_format_chk
    check (meta_pixel_id is null or meta_pixel_id ~ '^[0-9]{5,32}$'),
  constraint external_tracking_integrations_google_tag_id_format_chk
    check (google_tag_id is null or google_tag_id ~ '^(G|AW)-[A-Za-z0-9_-]{4,64}$'),
  constraint external_tracking_integrations_google_ads_conversion_id_format_chk
    check (google_ads_conversion_id is null or google_ads_conversion_id ~ '^AW-[A-Za-z0-9_-]{4,64}$'),
  constraint external_tracking_integrations_gtm_container_id_format_chk
    check (gtm_container_id is null or gtm_container_id ~ '^GTM-[A-Za-z0-9_-]{4,64}$'),
  constraint external_tracking_integrations_provider_fields_chk
    check (
      (
        provider = 'meta_pixel'
        and meta_pixel_id is not null
        and google_tag_id is null
        and google_ads_conversion_id is null
        and google_ads_conversion_label is null
        and gtm_container_id is null
        and consent_category = 'marketing'
      )
      or (
        provider = 'google_tag'
        and google_tag_id is not null
        and meta_pixel_id is null
        and google_ads_conversion_id is null
        and google_ads_conversion_label is null
        and gtm_container_id is null
      )
      or (
        provider = 'google_ads_conversion'
        and google_ads_conversion_id is not null
        and google_ads_conversion_label is not null
        and meta_pixel_id is null
        and google_tag_id is null
        and gtm_container_id is null
        and consent_category = 'marketing'
      )
      or (
        provider = 'google_tag_manager'
        and gtm_container_id is not null
        and meta_pixel_id is null
        and google_tag_id is null
        and google_ads_conversion_id is null
        and google_ads_conversion_label is null
      )
    )
);

create index if not exists external_tracking_integrations_provider_idx
  on public.external_tracking_integrations (provider);

create index if not exists external_tracking_integrations_enabled_idx
  on public.external_tracking_integrations (enabled);

create index if not exists external_tracking_integrations_trigger_event_idx
  on public.external_tracking_integrations (trigger_event);

create index if not exists external_tracking_integrations_consent_category_idx
  on public.external_tracking_integrations (consent_category);

create index if not exists external_tracking_integrations_updated_at_idx
  on public.external_tracking_integrations (updated_at);

drop trigger if exists set_updated_at_external_tracking_integrations
  on public.external_tracking_integrations;

create trigger set_updated_at_external_tracking_integrations
before update on public.external_tracking_integrations
for each row
execute function public.tg_set_updated_at();

alter table public.external_tracking_integrations enable row level security;

revoke all on table public.external_tracking_integrations from anon, authenticated;
grant all on table public.external_tracking_integrations to service_role;
