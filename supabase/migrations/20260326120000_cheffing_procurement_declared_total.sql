-- Add optional header total declared by supplier document to compare with computed lines total.

alter table public.cheffing_purchase_documents
  add column if not exists declared_total numeric null;

alter table public.cheffing_purchase_documents
  drop constraint if exists cheffing_purchase_documents_declared_total_nonnegative;

alter table public.cheffing_purchase_documents
  add constraint cheffing_purchase_documents_declared_total_nonnegative
  check (declared_total is null or declared_total >= 0);
