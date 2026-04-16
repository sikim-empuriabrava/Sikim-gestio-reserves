alter table public.app_allowed_users
  add column if not exists view_live_capacity boolean not null default false,
  add column if not exists manage_live_capacity boolean not null default false;

create table if not exists public.discotheque_capacity_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_slug text not null default 'sikim-discoteca',
  status text not null check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by text,
  closed_by text,
  current_count integer not null default 0 check (current_count >= 0),
  peak_count integer not null default 0 check (peak_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists discotheque_capacity_sessions_one_open_per_venue_idx
  on public.discotheque_capacity_sessions (venue_slug)
  where status = 'open';

create index if not exists discotheque_capacity_sessions_venue_opened_at_idx
  on public.discotheque_capacity_sessions (venue_slug, opened_at desc);

create table if not exists public.discotheque_capacity_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.discotheque_capacity_sessions(id) on delete cascade,
  delta integer not null check (delta <> 0),
  resulting_count integer not null check (resulting_count >= 0),
  actor_email text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists discotheque_capacity_events_session_created_at_idx
  on public.discotheque_capacity_events (session_id, created_at desc);

drop trigger if exists set_updated_at_discotheque_capacity_sessions
  on public.discotheque_capacity_sessions;

create trigger set_updated_at_discotheque_capacity_sessions
before update on public.discotheque_capacity_sessions
for each row
execute function public.tg_set_updated_at();

create or replace function public.open_discotheque_capacity_session(
  p_actor_email text,
  p_venue_slug text default 'sikim-discoteca'
)
returns public.discotheque_capacity_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open_session public.discotheque_capacity_sessions;
  v_created_session public.discotheque_capacity_sessions;
begin
  select *
  into v_open_session
  from public.discotheque_capacity_sessions
  where venue_slug = p_venue_slug
    and status = 'open'
  limit 1;

  if found then
    raise exception 'already an open session for venue %', p_venue_slug;
  end if;

  insert into public.discotheque_capacity_sessions (
    venue_slug,
    status,
    opened_by,
    current_count,
    peak_count
  )
  values (
    p_venue_slug,
    'open',
    nullif(trim(p_actor_email), ''),
    0,
    0
  )
  returning * into v_created_session;

  return v_created_session;
end;
$$;

create or replace function public.adjust_discotheque_capacity(
  p_actor_email text,
  p_delta integer,
  p_note text default null,
  p_venue_slug text default 'sikim-discoteca'
)
returns public.discotheque_capacity_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.discotheque_capacity_sessions;
  v_new_count integer;
  v_event public.discotheque_capacity_events;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'delta must be non-zero';
  end if;

  select *
  into v_session
  from public.discotheque_capacity_sessions
  where venue_slug = p_venue_slug
    and status = 'open'
  limit 1
  for update;

  if not found then
    raise exception 'no open session for venue %', p_venue_slug;
  end if;

  v_new_count := v_session.current_count + p_delta;

  if v_new_count < 0 then
    raise exception 'capacity adjustment below zero is not allowed';
  end if;

  update public.discotheque_capacity_sessions
  set
    current_count = v_new_count,
    peak_count = greatest(peak_count, v_new_count),
    updated_at = now()
  where id = v_session.id
  returning * into v_session;

  insert into public.discotheque_capacity_events (
    session_id,
    delta,
    resulting_count,
    actor_email,
    note
  )
  values (
    v_session.id,
    p_delta,
    v_new_count,
    nullif(trim(p_actor_email), ''),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning * into v_event;

  return v_event;
end;
$$;

create or replace function public.close_discotheque_capacity_session(
  p_actor_email text,
  p_venue_slug text default 'sikim-discoteca'
)
returns public.discotheque_capacity_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.discotheque_capacity_sessions;
begin
  select *
  into v_session
  from public.discotheque_capacity_sessions
  where venue_slug = p_venue_slug
    and status = 'open'
  limit 1
  for update;

  if not found then
    raise exception 'no open session for venue %', p_venue_slug;
  end if;

  update public.discotheque_capacity_sessions
  set
    status = 'closed',
    closed_at = now(),
    closed_by = nullif(trim(p_actor_email), ''),
    updated_at = now()
  where id = v_session.id
  returning * into v_session;

  return v_session;
end;
$$;
