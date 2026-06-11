create table if not exists public.customer_reservation_notifications (
  id uuid primary key default gen_random_uuid(),
  group_event_id uuid not null references public.group_events(id) on delete cascade,
  channel text not null check (channel in ('email')),
  notification_type text not null check (notification_type in ('reservation_confirmed')),
  recipient text not null,
  recipient_name_snapshot text null,
  status text not null check (status in ('pending', 'sent', 'skipped', 'failed', 'provider_not_configured')),
  provider text null,
  provider_message_id text null,
  subject_snapshot text null,
  body_text_snapshot text null,
  payload_snapshot jsonb not null default '{}'::jsonb,
  error_message text null,
  sent_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (group_event_id, channel, notification_type)
);

create index if not exists customer_reservation_notifications_group_event_idx
  on public.customer_reservation_notifications (group_event_id);

create index if not exists customer_reservation_notifications_status_created_idx
  on public.customer_reservation_notifications (status, created_at desc);

drop trigger if exists set_updated_at_customer_reservation_notifications
  on public.customer_reservation_notifications;

create trigger set_updated_at_customer_reservation_notifications
before update on public.customer_reservation_notifications
for each row
execute function public.tg_set_updated_at();

alter table public.customer_reservation_notifications enable row level security;

revoke all on table public.customer_reservation_notifications from anon, authenticated;
grant all on table public.customer_reservation_notifications to service_role;
