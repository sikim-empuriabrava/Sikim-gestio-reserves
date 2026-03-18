alter table public.cheffing_dishes
add column if not exists notes text;

update public.cheffing_dishes
set notes = description
where notes is null
  and description is not null;
