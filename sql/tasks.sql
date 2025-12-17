create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('maintenance','kitchen')),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_date date,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_area_status_idx on public.tasks(area, status);
create index if not exists tasks_due_date_idx on public.tasks(due_date);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_timestamp_tasks on public.tasks;
create trigger set_timestamp_tasks
before update on public.tasks
for each row execute function public.set_updated_at();
