alter table public.app_allowed_users
  add column if not exists notify_external_reservations boolean not null default false;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null references public.app_allowed_users(email) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_label text,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  disabled_at timestamptz,
  constraint web_push_subscriptions_endpoint_not_empty check (btrim(endpoint) <> ''),
  constraint web_push_subscriptions_p256dh_not_empty check (btrim(p256dh) <> ''),
  constraint web_push_subscriptions_auth_not_empty check (btrim(auth) <> '')
);

create unique index if not exists web_push_subscriptions_endpoint_idx
  on public.web_push_subscriptions (endpoint);

create index if not exists web_push_subscriptions_user_email_idx
  on public.web_push_subscriptions (user_email);

create index if not exists web_push_subscriptions_is_active_idx
  on public.web_push_subscriptions (is_active);

create index if not exists web_push_subscriptions_user_email_is_active_idx
  on public.web_push_subscriptions (user_email, is_active);

drop trigger if exists set_updated_at_web_push_subscriptions
  on public.web_push_subscriptions;

create trigger set_updated_at_web_push_subscriptions
before update on public.web_push_subscriptions
for each row
execute function public.tg_set_updated_at();

alter table public.web_push_subscriptions enable row level security;

revoke all on table public.web_push_subscriptions from anon, authenticated;
grant all on table public.web_push_subscriptions to service_role;
