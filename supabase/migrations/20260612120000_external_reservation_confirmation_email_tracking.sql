alter table public.external_reservation_submissions
  add column if not exists confirmation_email_sent_at timestamptz null,
  add column if not exists confirmation_email_attempted_at timestamptz null,
  add column if not exists confirmation_email_to text null,
  add column if not exists confirmation_email_language text null,
  add column if not exists confirmation_email_provider text null,
  add column if not exists confirmation_email_provider_id text null,
  add column if not exists confirmation_email_error text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_reservation_submissions_confirmation_email_language_check'
      and conrelid = 'public.external_reservation_submissions'::regclass
  ) then
    alter table public.external_reservation_submissions
      add constraint external_reservation_submissions_confirmation_email_language_check
      check (
        confirmation_email_language is null
        or confirmation_email_language in ('ca', 'es', 'fr', 'en', 'de', 'nl', 'it')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_reservation_submissions_confirmation_email_provider_check'
      and conrelid = 'public.external_reservation_submissions'::regclass
  ) then
    alter table public.external_reservation_submissions
      add constraint external_reservation_submissions_confirmation_email_provider_check
      check (
        confirmation_email_provider is null
        or confirmation_email_provider in ('resend')
      );
  end if;
end $$;

create index if not exists external_reservation_submissions_confirmation_email_sent_at_idx
  on public.external_reservation_submissions (confirmation_email_sent_at);

create index if not exists external_reservation_submissions_confirmation_email_attempted_at_idx
  on public.external_reservation_submissions (confirmation_email_attempted_at);
