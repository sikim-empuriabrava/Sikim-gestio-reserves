ALTER TABLE public.app_allowed_users
  ADD COLUMN IF NOT EXISTS can_cheffing boolean NOT NULL DEFAULT false;

SELECT id, email, role, is_active, can_cheffing
FROM public.app_allowed_users
ORDER BY email ASC;
