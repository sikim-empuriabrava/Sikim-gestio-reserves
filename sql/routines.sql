create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('maintenance','kitchen')),
  title text not null,
  description text,
  day_of_week smallint not null check (day_of_week >= 1 and day_of_week <= 7),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routines_active_day_idx on public.routines(is_active, day_of_week);
create index if not exists routines_area_idx on public.routines(area);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_timestamp_routines on public.routines;
create trigger set_timestamp_routines
before update on public.routines
for each row execute function public.set_updated_at();
