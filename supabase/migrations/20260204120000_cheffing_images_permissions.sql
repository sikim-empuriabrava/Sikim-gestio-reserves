alter table public.app_allowed_users
  add column if not exists cheffing_images_manage boolean not null default false;

alter table public.cheffing_dishes
  add column if not exists image_path text;

alter table storage.objects enable row level security;

drop policy if exists "cheffing images read" on storage.objects;
drop policy if exists "cheffing images manage insert" on storage.objects;
drop policy if exists "cheffing images manage update" on storage.objects;
drop policy if exists "cheffing images manage delete" on storage.objects;

create policy "cheffing images read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cheffing-images'
  and exists (
    select 1
    from public.app_allowed_users
    where is_active = true
      and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), current_setting('request.jwt.claim.email', true)))
      and (role = 'admin' or can_cheffing = true)
  )
);

create policy "cheffing images manage insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cheffing-images'
  and exists (
    select 1
    from public.app_allowed_users
    where is_active = true
      and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), current_setting('request.jwt.claim.email', true)))
      and (role = 'admin' or cheffing_images_manage = true)
  )
);

create policy "cheffing images manage update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cheffing-images'
  and exists (
    select 1
    from public.app_allowed_users
    where is_active = true
      and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), current_setting('request.jwt.claim.email', true)))
      and (role = 'admin' or cheffing_images_manage = true)
  )
)
with check (
  bucket_id = 'cheffing-images'
  and exists (
    select 1
    from public.app_allowed_users
    where is_active = true
      and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), current_setting('request.jwt.claim.email', true)))
      and (role = 'admin' or cheffing_images_manage = true)
  )
);

create policy "cheffing images manage delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cheffing-images'
  and exists (
    select 1
    from public.app_allowed_users
    where is_active = true
      and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), current_setting('request.jwt.claim.email', true)))
      and (role = 'admin' or cheffing_images_manage = true)
  )
);
