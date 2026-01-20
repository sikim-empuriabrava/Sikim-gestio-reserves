-- Objetivo: endurecer la columna public.tasks.status para que solo acepte 'open' o 'done'
-- sin modificar el enum task_status (mantiene 'in_progress').
--
-- PRE-CHECKS
-- Verifica el estado actual:
SELECT status, COUNT(*)
FROM public.tasks
GROUP BY status
ORDER BY status;

SELECT COUNT(*) AS invalid_status_count
FROM public.tasks
WHERE status NOT IN ('open', 'done');

-- NORMALIZA ESTADOS LEGACY
UPDATE public.tasks
SET status = 'open'
WHERE status = 'in_progress';

-- APLICA LA RESTRICCIÓN (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'tasks_status_open_done_check'
      AND t.relname = 'tasks'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_status_open_done_check
      CHECK (status IN ('open', 'done'));
  END IF;
END $$;

-- POST-CHECKS
-- Confirma la constraint:
SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE t.relname = 'tasks'
  AND n.nspname = 'public'
  AND c.conname = 'tasks_status_open_done_check';

-- Re-ejecuta la verificación de valores:
SELECT status, COUNT(*)
FROM public.tasks
GROUP BY status
ORDER BY status;
