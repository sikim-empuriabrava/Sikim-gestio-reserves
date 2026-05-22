create table if not exists public.external_reservation_submissions (
  id uuid primary key default gen_random_uuid(),
  group_event_id uuid not null references public.group_events(id) on delete cascade,
  source_label text not null default 'Direct / Unknown',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_page text,
  fbclid text,
  gclid text,
  ttclid text,
  preferred_language text,
  privacy_accepted_at timestamptz not null,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_source text,
  ip_hash text,
  user_agent text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_reservation_submissions_source_label_not_empty
    check (btrim(source_label) <> ''),
  constraint external_reservation_submissions_preferred_language_check
    check (
      preferred_language is null
      or preferred_language in ('ca', 'es', 'fr', 'en', 'de', 'nl', 'it')
    )
);

create unique index if not exists external_reservation_submissions_group_event_id_idx
  on public.external_reservation_submissions (group_event_id);

create index if not exists external_reservation_submissions_submitted_at_idx
  on public.external_reservation_submissions (submitted_at);

create index if not exists external_reservation_submissions_source_label_idx
  on public.external_reservation_submissions (source_label);

create index if not exists external_reservation_submissions_utm_source_idx
  on public.external_reservation_submissions (utm_source);

create index if not exists external_reservation_submissions_preferred_language_idx
  on public.external_reservation_submissions (preferred_language);

drop trigger if exists set_updated_at_external_reservation_submissions on public.external_reservation_submissions;
create trigger set_updated_at_external_reservation_submissions
before update on public.external_reservation_submissions
for each row
execute function public.tg_set_updated_at();

alter table public.external_reservation_submissions enable row level security;

revoke all on table public.external_reservation_submissions from anon, authenticated;
grant all on table public.external_reservation_submissions to service_role;
