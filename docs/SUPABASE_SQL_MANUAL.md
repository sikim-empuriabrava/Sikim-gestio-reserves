```sql
alter table if exists public.cheffing_ingredients
  add column if not exists allergens text[] not null default '{}',
  add column if not exists indicators text[] not null default '{}';

alter table if exists public.cheffing_subrecipes
  add column if not exists allergens_manual_add text[] not null default '{}',
  add column if not exists allergens_manual_exclude text[] not null default '{}',
  add column if not exists indicators_manual_add text[] not null default '{}',
  add column if not exists indicators_manual_exclude text[] not null default '{}';

alter table if exists public.cheffing_dishes
  add column if not exists allergens_manual_add text[] not null default '{}',
  add column if not exists allergens_manual_exclude text[] not null default '{}',
  add column if not exists indicators_manual_add text[] not null default '{}',
  add column if not exists indicators_manual_exclude text[] not null default '{}',
  add column if not exists image_path text;
```
