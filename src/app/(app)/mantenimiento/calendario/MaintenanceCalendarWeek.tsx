'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type TaskStatus = 'open' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'normal' | 'high';

type Task = {
  id: string;
  area: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  window_start_date?: string | null;
  due_date?: string | null;
};

type DayColumn = {
  iso: string;
  label: string;
};

const statusLabels: Record<TaskStatus, string> = {
  open: 'Abierta',
  in_progress: 'En curso',
  done: 'Hecha',
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

const statusStyles: Record<TaskStatus, string> = {
  open: 'bg-amber-900/40 text-amber-200 border-amber-700/70',
  in_progress: 'bg-blue-900/40 text-blue-100 border-blue-700/60',
  done: 'bg-emerald-900/40 text-emerald-100 border-emerald-700/60',
};

const priorityStyles: Record<TaskPriority, string> = {
  low: 'text-emerald-300',
  normal: 'text-slate-200',
  high: 'text-amber-200',
};

function getStartOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '');
}

function buildWeek() {
  const start = getStartOfWeek(new Date());
  const days: DayColumn[] = [];

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    days.push({
      iso: date.toISOString().slice(0, 10),
      label: formatDateLabel(date),
    });
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const rangeLabel = `${new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(start)} - ${new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(end)}`;

  return { days, start: days[0].iso, end: days[6].iso, rangeLabel };
}

export function MaintenanceCalendarWeek() {
  const { days, start, end, rangeLabel } = useMemo(buildWeek, []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [priorityUpdatingId, setPriorityUpdatingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      area: 'maintenance',
      due_date_from: start,
      due_date_to: end,
      include_no_due_date: 'true',
    });

    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }

    try {
      const response = await fetch(`/api/tasks?${params.toString()}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudieron cargar las tareas');
      }

      const data: Task[] = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [end, start, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusAdvance = async (task: Task) => {
    const nextStatus = statusCycle[task.status];
    if (!nextStatus) return;

    setStatusUpdatingId(task.id);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${task.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo actualizar el estado');
      }

      const updated: Task = await response.json();
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handlePriorityChange = async (task: Task, priority: TaskPriority) => {
    if (priority === task.priority) return;

    setPriorityUpdatingId(task.id);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo actualizar la prioridad');
      }

      const updated: Task = await response.json();
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setPriorityUpdatingId(null);
    }
  };

  const tasksByDate = useMemo(
    () =>
      days.reduce<Record<string, Task[]>>((acc, day) => {
        acc[day.iso] = tasks.filter((task) => task.due_date === day.iso);
        return acc;
      }, {}),
    [days, tasks]
  );

  const undatedTasks = useMemo(() => tasks.filter((task) => !task.due_date), [tasks]);

  const isUpdating = (taskId: string) => statusUpdatingId === taskId || priorityUpdatingId === taskId;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Calendario de tareas (semana)</h1>
        <p className="text-slate-400">Semana actual: {rangeLabel}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <span className="text-sm font-medium text-slate-300">Estado:</span>
        {(['all', 'open', 'in_progress', 'done'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              statusFilter === status
                ? 'bg-primary-600/80 text-white shadow shadow-primary-900/30'
                : 'text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {status === 'all' ? 'Todas' : statusLabels[status]}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-amber-700 bg-amber-900/40 p-3 text-amber-100">{error}</div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {days.map((day) => (
            <div key={day.iso} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{day.label}</p>
                <span className="text-xs text-slate-400">{day.iso}</span>
              </div>

              <div className="space-y-3">
                {tasksByDate[day.iso]?.length ? (
                  tasksByDate[day.iso].map((task) => (
                    <div
                      key={task.id}
                      className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-semibold text-white">{task.title}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                            <span className={`rounded-md border px-2 py-0.5 ${statusStyles[task.status]}`}>
                              {statusLabels[task.status]}
                            </span>
                            <span className={`${priorityStyles[task.priority]} rounded-md border border-slate-800 px-2 py-0.5`}>
                              Prioridad: {priorityLabels[task.priority]}
                            </span>
                          </div>
                        </div>
                        <Link
                          href="/mantenimiento/tareas"
                          className="text-xs font-semibold text-primary-300 transition hover:text-primary-100"
                        >
                          Ver/editar
                        </Link>
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm">
                        {statusCycle[task.status] && (
                          <button
                            type="button"
                            disabled={isUpdating(task.id)}
                            onClick={() => handleStatusAdvance(task)}
                            className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                              isUpdating(task.id)
                                ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                                : 'bg-slate-100 text-slate-900 hover:bg-white'
                            }`}
                          >
                            Mover a {statusLabels[statusCycle[task.status] as TaskStatus]}
                          </button>
                        )}

                        <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs font-medium text-slate-200">
                          Prioridad
                          <select
                            className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                            value={task.priority}
                            onChange={(event) => handlePriorityChange(task, event.target.value as TaskPriority)}
                            disabled={isUpdating(task.id)}
                          >
                            {(Object.keys(priorityLabels) as TaskPriority[]).map((option) => (
                              <option key={option} value={option}>
                                {priorityLabels[option]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Sin tareas programadas</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Sin fecha</h2>
            <span className="text-xs text-slate-400">Tareas sin due_date</span>
          </div>

          {undatedTasks.length ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {undatedTasks.map((task) => (
                <div
                  key={task.id}
                  className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-semibold text-white">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <span className={`rounded-md border px-2 py-0.5 ${statusStyles[task.status]}`}>
                          {statusLabels[task.status]}
                        </span>
                        <span className={`${priorityStyles[task.priority]} rounded-md border border-slate-800 px-2 py-0.5`}>
                          Prioridad: {priorityLabels[task.priority]}
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/mantenimiento/tareas"
                      className="text-xs font-semibold text-primary-300 transition hover:text-primary-100"
                    >
                      Ver/editar
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    {statusCycle[task.status] && (
                      <button
                        type="button"
                        disabled={isUpdating(task.id)}
                        onClick={() => handleStatusAdvance(task)}
                        className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                          isUpdating(task.id)
                            ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                            : 'bg-slate-100 text-slate-900 hover:bg-white'
                        }`}
                      >
                        Mover a {statusLabels[statusCycle[task.status] as TaskStatus]}
                      </button>
                    )}

                    <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs font-medium text-slate-200">
                      Prioridad
                      <select
                        className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                        value={task.priority}
                        onChange={(event) => handlePriorityChange(task, event.target.value as TaskPriority)}
                        disabled={isUpdating(task.id)}
                      >
                        {(Object.keys(priorityLabels) as TaskPriority[]).map((option) => (
                          <option key={option} value={option}>
                            {priorityLabels[option]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Sin tareas sin fecha.</p>
          )}
        </div>
      )}
    </div>
  );
}
