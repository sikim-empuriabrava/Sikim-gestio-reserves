'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  OperationalEmptyState,
  OperationalPageHeader,
  OperationalPanel,
  OperationalPill,
  operationalSecondaryButtonClass,
} from '@/components/operational/OperationalUI';

type UiStatus = 'open' | 'done';
type TaskPriority = 'low' | 'normal' | 'high';

type Task = {
  id: string;
  area: string;
  title: string;
  description: string | null;
  status: string;
  priority: TaskPriority;
  window_start_date?: string | null;
  due_date?: string | null;
};

type DayColumn = {
  iso: string;
  label: string;
};

const statusLabels: Record<UiStatus, string> = {
  open: 'Abierta',
  done: 'Hecha',
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
};

const priorityTone: Record<TaskPriority, 'success' | 'neutral' | 'warning'> = {
  low: 'success',
  normal: 'neutral',
  high: 'warning',
};

function toUiStatus(status: string): UiStatus {
  return status === 'done' ? 'done' : 'open';
}

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

function TaskCard({
  task,
  isUpdating,
  onStatusAdvance,
  onPriorityChange,
}: {
  task: Task;
  isUpdating: boolean;
  onStatusAdvance: (task: Task) => void;
  onPriorityChange: (task: Task, priority: TaskPriority) => void;
}) {
  const currentStatus = toUiStatus(task.status);

  return (
    <div className="space-y-3 rounded-2xl border border-[#4a3f32]/70 bg-[#151412]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-lg font-semibold leading-tight text-[#f6f0e8]">{task.title}</p>
          {task.description ? <p className="text-sm leading-6 text-[#b9aea1]">{task.description}</p> : null}
          <div className="flex flex-wrap gap-2">
            <OperationalPill tone={currentStatus === 'done' ? 'success' : 'warning'}>
              {statusLabels[currentStatus]}
            </OperationalPill>
            <OperationalPill tone={priorityTone[task.priority]}>Prioridad: {priorityLabels[task.priority]}</OperationalPill>
          </div>
        </div>
        <Link
          href="/mantenimiento/tareas"
          className="shrink-0 text-sm font-semibold text-[#d69c57] transition hover:text-[#ffe2b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/35"
        >
          Ver/editar
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onStatusAdvance(task)}
          className={operationalSecondaryButtonClass}
        >
          <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
          {currentStatus === 'open' ? 'Marcar como hecha' : 'Reabrir'}
        </button>

        <label className="flex items-center gap-2 rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/80 px-3 py-2 text-xs font-medium text-[#d8cfc2]">
          Prioridad
          <select
            className="rounded-lg border border-[#4a3f32]/70 bg-[#181715] px-2 py-1 text-xs text-[#f6f0e8] focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/20 disabled:cursor-not-allowed disabled:opacity-70"
            value={task.priority}
            onChange={(event) => onPriorityChange(task, event.target.value as TaskPriority)}
            disabled={isUpdating}
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
  );
}

export function MaintenanceCalendarWeek() {
  const { days, start, end, rangeLabel } = useMemo(buildWeek, []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | UiStatus>('all');
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

    if (statusFilter === 'done') {
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
    const currentStatus = toUiStatus(task.status);
    const nextStatus: UiStatus = currentStatus === 'open' ? 'done' : 'open';

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

  const visibleTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((task) => toUiStatus(task.status) === statusFilter);
  }, [statusFilter, tasks]);

  const tasksByDate = useMemo(
    () =>
      days.reduce<Record<string, Task[]>>((acc, day) => {
        acc[day.iso] = visibleTasks.filter((task) => task.due_date === day.iso);
        return acc;
      }, {}),
    [days, visibleTasks],
  );

  const undatedTasks = useMemo(() => visibleTasks.filter((task) => !task.due_date), [visibleTasks]);

  const isUpdating = (taskId: string) => statusUpdatingId === taskId || priorityUpdatingId === taskId;

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Calendario de tareas (semana)"
        meta={
          <span className="inline-flex items-center gap-2">
            <CalendarDaysIcon className="h-5 w-5 text-[#a99d90]" aria-hidden="true" />
            Semana actual: {rangeLabel}
          </span>
        }
      />

      <OperationalPanel className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-[#d8cfc2]">Estado:</span>
          {(['all', 'open', 'done'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/35 ${
                statusFilter === status
                  ? 'border-[#b77b3e]/55 bg-[#7d5932]/48 text-[#ffe2b6]'
                  : 'border-[#4a3f32]/75 bg-[#151412]/70 text-[#d8cfc2] hover:border-[#8b6a43]/70 hover:bg-[#211f1b]'
              }`}
            >
              {status === 'all' ? 'Todas' : statusLabels[status]}
            </button>
          ))}
        </div>
      </OperationalPanel>

      {error ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-2xl border border-[#4a3f32]/55 bg-[#181715]/70" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {days.map((day, index) => (
            <OperationalPanel
              key={day.iso}
              className={`min-h-[13rem] p-4 ${index === 0 ? 'border-[#c98545]/75 bg-[#211b16]/95' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold leading-tight text-[#f6f0e8]">{day.label}</p>
                  <p className="mt-1 text-xs text-[#8f8578]">{day.iso}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#6f5434]/65 bg-[#3a2a1b]/60 text-[#e0aa69]">
                  <CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {tasksByDate[day.iso]?.length ? (
                  tasksByDate[day.iso].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isUpdating={isUpdating(task.id)}
                      onStatusAdvance={handleStatusAdvance}
                      onPriorityChange={handlePriorityChange}
                    />
                  ))
                ) : (
                  <p className="inline-flex items-center gap-2 text-sm text-[#a99d90]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#d69c57]" aria-hidden="true" />
                    Sin tareas programadas
                  </p>
                )}
              </div>
            </OperationalPanel>
          ))}
        </div>
      )}

      {!loading ? (
        <OperationalPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[#f6f0e8]">Sin fecha</h2>
            <span className="text-sm text-[#a99d90]">Tareas sin due_date</span>
          </div>

          <div className="mt-5">
            {undatedTasks.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {undatedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isUpdating={isUpdating(task.id)}
                    onStatusAdvance={handleStatusAdvance}
                    onPriorityChange={handlePriorityChange}
                  />
                ))}
              </div>
            ) : (
              <OperationalEmptyState
                icon={statusFilter === 'all' ? ClipboardDocumentListIcon : ExclamationTriangleIcon}
                title="Sin tareas sin fecha."
                description="Las tareas que no tengan fecha límite aparecerán agrupadas en esta sección."
                className="min-h-[12rem]"
              />
            )}
          </div>
        </OperationalPanel>
      ) : null}
    </div>
  );
}
