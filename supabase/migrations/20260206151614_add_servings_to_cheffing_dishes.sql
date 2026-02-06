alter table public.cheffing_dishes
  add column if not exists servings integer;

update public.cheffing_dishes
set servings = 1
where servings is null;

alter table public.cheffing_dishes
  alter column servings set default 1,
  alter column servings set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_dishes_servings_check'
  ) then
    alter table public.cheffing_dishes
      add constraint cheffing_dishes_servings_check
      check (servings > 0);
  end if;
end $$;
