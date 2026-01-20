-- Objetivo: endurecer la columna tasks.status para que solo acepte 'open' o 'done'
-- sin modificar el enum task_status (mantiene 'in_progress').
--
-- PRE-CHECKS
-- Verifica si existen valores fuera de ('open', 'done'):
--   SELECT status, COUNT(*)
--   FROM tasks
--   GROUP BY status
--   ORDER BY status;
--
--   SELECT COUNT(*) AS invalid_status_count
--   FROM tasks
--   WHERE status NOT IN ('open', 'done');
--
-- APLICA LA RESTRICCIÓN
BEGIN;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_open_done_check
  CHECK (status IN ('open', 'done'));

COMMIT;

-- POST-CHECKS
-- Confirma la constraint:
--   SELECT conname, pg_get_constraintdef(c.oid) AS definition
--   FROM pg_constraint c
--   JOIN pg_class t ON t.oid = c.conrelid
--   WHERE t.relname = 'tasks'
--     AND c.conname = 'tasks_status_open_done_check';
--
-- Re-ejecuta la verificación de valores:
--   SELECT status, COUNT(*)
--   FROM tasks
--   GROUP BY status
--   ORDER BY status;
