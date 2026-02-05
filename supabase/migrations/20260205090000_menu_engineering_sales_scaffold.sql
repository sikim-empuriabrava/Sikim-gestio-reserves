create table if not exists public.cheffing_pos_sales_daily (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  pos_provider text not null,
  pos_product_id text not null,
  dish_id uuid references public.cheffing_dishes(id),
  quantity numeric(12, 3) not null default 0,
  gross_total numeric(12, 2),
  net_total numeric(12, 2),
  tax_total numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pos_provider, pos_product_id, sale_date)
);

alter table public.cheffing_pos_sales_daily enable row level security;

create policy "Cheffing read pos sales daily"
  on public.cheffing_pos_sales_daily
  for select
  using (public.cheffing_is_allowed());

create policy "Cheffing admin insert pos sales daily"
  on public.cheffing_pos_sales_daily
  for insert
  with check (public.cheffing_is_admin());

create policy "Cheffing admin update pos sales daily"
  on public.cheffing_pos_sales_daily
  for update
  using (public.cheffing_is_admin())
  with check (public.cheffing_is_admin());

create policy "Cheffing admin delete pos sales daily"
  on public.cheffing_pos_sales_daily
  for delete
  using (public.cheffing_is_admin());
