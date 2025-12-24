'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type TaskStatus = 'open' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'normal' | 'high';

export type RoutineTask = {
  id: string;
  area: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  window_start_date?: string | null;
  due_date?: string | null;
  routine_id?: string | null;
  routine_week_start?: string | null;
};

type Props = {
  initialTasks: RoutineTask[];
  weekStart: string;
};

const statusLabels: Record<TaskStatus, string> = {
  open: 'Abiertas',
  in_progress: 'En curso',
  done: 'Hechas',
};

const statusCycle: Record<TaskStatus, TaskStatus | null> = {
  open: 'in_progress',
  in_progress: 'done',
  done: null,
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
};

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-emerald-900/30 text-emerald-200 border-emerald-800/70',
  normal: 'bg-slate-800/70 text-slate-100 border-slate-700',
  high: 'bg-amber-900/40 text-amber-100 border-amber-700',
};

function toUtcMonday(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const day = parsed.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10);
}

function formatDay(value?: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' })
      .format(new Date(`${value}T00:00:00Z`))
      .replace('.', '');
  } catch {
    return value;
  }
}

function buildWindowLabel(task: RoutineTask) {
  const start = task.window_start_date ?? task.due_date;
  const end = task.due_date ?? task.window_start_date;

  if (!start && !end) return 'Sin ventana';

  const startLabel = formatDay(start);
  const endLabel = formatDay(end);

  if (startLabel && endLabel) {
    return `${startLabel} → ${endLabel}`;
  }

  return startLabel ?? endLabel ?? 'Sin ventana';
}

function sortByDateLike(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

export function MaintenanceRoutineWeekBoard({ initialTasks, weekStart }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<RoutineTask[]>(initialTasks);
  const [selectedWeek, setSelectedWeek] = useState(weekStart);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupedTasks = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; sortKey: number; label: string; tasks: RoutineTask[] }
    >();

    tasks.forEach((task) => {
      const start = task.window_start_date ?? task.due_date ?? 'sin_inicio';
      const end = task.due_date ?? task.window_start_date ?? start;
      const key = `${start}|${end}`;
      const label = buildWindowLabel(task);

      const existing = groups.get(key);
      const sortKey = sortByDateLike(start);

      if (existing) {
        existing.tasks.push(task);
      } else {
        groups.set(key, { key, sortKey, label, tasks: [task] });
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [tasks]);

  const summary = useMemo(
    () =>
      tasks.reduce(
        (acc, task) => {
          acc[task.status] += 1;
          return acc;
        },
        { open: 0, in_progress: 0, done: 0 } as Record<TaskStatus, number>,
      ),
    [tasks],
  );

  const updateWeek = (value: string) => {
    const normalized = toUtcMonday(value) ?? value;
    const params = new URLSearchParams(searchParams?.toString());
    setSelectedWeek(normalized);

    if (normalized) {
      params.set('week_start', normalized);
    } else {
      params.delete('week_start');
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    router.refresh();
  };

  const handleGenerateWeek = async () => {
    setIsGenerating(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/routines/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: selectedWeek }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron generar las tareas');
      }

      const created = payload?.created ?? 0;
      const skipped = payload?.skipped ?? 0;
      setMessage(`Generación completada: ${created} creadas, ${skipped} omitidas.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron generar las tareas');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdvanceStatus = async (task: RoutineTask) => {
    const nextStatus = statusCycle[task.status];
    if (!nextStatus) return;

    setIsUpdating(task.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/tasks/${task.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo actualizar el estado');
      }

      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, ...payload } : item)));
      setMessage('Estado actualizado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado');
    } finally {
      setIsUpdating(null);
    }
  };

  const renderEmptyState = () => (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-sm text-slate-300">
      <p className="font-semibold text-slate-100">No hay tareas de rutina para esta semana.</p>
      <p className="mt-1 text-slate-400">
        Lanza la generación para sincronizar las rutinas activas con el plan semanal.
      </p>
      <button
        type="button"
        onClick={handleGenerateWeek}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isGenerating}
      >
        {isGenerating ? 'Generando...' : 'Generar / Sincronizar'}
      </button>
    </div>
  );

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    setSelectedWeek(weekStart);
  }, [weekStart]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-white">Plan semanal</p>
          <p className="text-sm text-slate-400">Basado en rutinas automáticas y listo para seguimiento.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-wide text-slate-400">Semana (lunes)</span>
            <input
              type="date"
              value={selectedWeek}
              onChange={(event) => updateWeek(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleGenerateWeek}
            disabled={isGenerating}
            className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? 'Generando...' : 'Generar / Sincronizar'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
        {(Object.keys(statusLabels) as TaskStatus[]).map((status) => (
          <div
            key={status}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">{statusLabels[status]}</span>
            <span className="text-lg font-semibold text-white">{summary[status]}</span>
          </div>
        ))}
        <div className="ml-auto">
          <Link
            href="/mantenimiento/tareas"
            className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 font-semibold text-slate-100 transition hover:border-slate-500"
          >
            Ver incidencias manuales
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-amber-200">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      {tasks.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {groupedTasks.map((group) => (
            <div
              key={group.key}
              className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                    Ventana
                  </span>
                  <span>{group.label}</span>
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  {group.tasks.length} tareas
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.tasks.map((task) => {
                  const nextStatus = statusCycle[task.status];
                  const windowLabel = buildWindowLabel(task);
                  return (
                    <div key={task.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-100">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">{task.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                        <span
                          className={`rounded-full border px-2 py-1 font-semibold ${priorityStyles[task.priority]}`}
                        >
                          Prioridad: {priorityLabels[task.priority]}
                        </span>
                        <span className="rounded-full bg-slate-800 px-2 py-1">Ventana: {windowLabel}</span>
                      </div>

                      {nextStatus && (
                        <button
                          type="button"
                          disabled={isUpdating === task.id}
                          onClick={() => handleAdvanceStatus(task)}
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUpdating === task.id ? 'Actualizando...' : `Avanzar a "${statusLabels[nextStatus]}"`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
