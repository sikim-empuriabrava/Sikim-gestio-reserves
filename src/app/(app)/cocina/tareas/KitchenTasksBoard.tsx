'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDaysIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  OperationalEmptyState,
  OperationalPanel,
  OperationalPill,
  operationalFieldClass,
  operationalLabelClass,
  operationalPrimaryButtonClass,
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
  created_by_email?: string | null;
  created_at?: string;
  updated_at?: string;
};

const statusLabels: Record<UiStatus, string> = {
  open: 'Abiertas',
  done: 'Hechas',
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

function formatShortDay(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
      .format(new Date(`${value}T00:00:00`))
      .replace('.', '');
  } catch {
    return value;
  }
}

function toUiStatus(status: string): UiStatus {
  return status === 'done' ? 'done' : 'open';
}

type Props = {
  initialTasks: Task[];
};

export function KitchenTasksBoard({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeStatus, setActiveStatus] = useState<UiStatus>('open');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => toUiStatus(task.status) === activeStatus),
    [tasks, activeStatus],
  );

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('normal');
    setDueDate('');
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: 'kitchen',
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_date: dueDate || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo crear la tarea');
      }

      const task: Task = await response.json();
      setTasks((prev) => [task, ...prev]);
      setMessage('Tarea creada');
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (task: Task) => {
    const currentStatus = toUiStatus(task.status);
    const nextStatus: UiStatus = currentStatus === 'open' ? 'done' : 'open';

    setUpdatingId(task.id);
    setError(null);
    setMessage(null);

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
      setMessage('Estado actualizado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-fit rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 p-1 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {(Object.keys(statusLabels) as UiStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              className={`rounded-lg px-5 py-2.5 font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/35 ${
                activeStatus === status
                  ? 'bg-[#7d5932]/70 text-[#ffe2b6] shadow-[inset_0_0_0_1px_rgba(231,181,118,0.34)]'
                  : 'text-[#b9aea1] hover:bg-[#24211d] hover:text-[#f2eadf]'
              }`}
              onClick={() => setActiveStatus(status)}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className={showForm ? operationalSecondaryButtonClass : operationalPrimaryButtonClass}
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          {showForm ? 'Cerrar' : 'Nueva tarea'}
        </button>
      </div>

      {showForm ? (
        <OperationalPanel className="p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className={operationalLabelClass}>
                <span className="block font-semibold">Título</span>
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={operationalFieldClass}
                  placeholder="Descripción corta de la tarea"
                />
              </label>

              <label className={operationalLabelClass}>
                <span className="block font-semibold">Fecha límite (opcional)</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={operationalFieldClass}
                />
              </label>
            </div>

            <label className={operationalLabelClass}>
              <span className="block font-semibold">Descripción</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={operationalFieldClass}
                rows={3}
                placeholder="Detalles para el equipo de cocina"
              />
            </label>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2 text-sm text-[#d8cfc2]">
                <span className="block font-semibold">Prioridad</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(priorityLabels) as TaskPriority[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPriority(value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/35 ${
                        priority === value
                          ? 'border-[#d6a76e]/60 bg-[#7d5932]/55 text-[#ffe2b6]'
                          : 'border-[#4a3f32]/80 bg-[#151412]/70 text-[#cfc4b5] hover:border-[#8b6a43]/70 hover:bg-[#211f1b] hover:text-[#efe8dc]'
                      }`}
                    >
                      {priorityLabels[value]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className={operationalSecondaryButtonClass}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className={operationalPrimaryButtonClass}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar tarea'}
                </button>
              </div>
            </div>

            {error ? <p className="text-sm text-amber-200">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          </form>
        </OperationalPanel>
      ) : null}

      {error && !showForm ? <p className="text-sm text-amber-200">{error}</p> : null}
      {message && !showForm ? <p className="text-sm text-emerald-300">{message}</p> : null}

      <div className="grid gap-3">
        {filteredTasks.length === 0 ? (
          <OperationalPanel className="p-5">
            <OperationalEmptyState
              icon={ClipboardDocumentCheckIcon}
              title={activeStatus === 'open' ? 'No hay tareas abiertas' : 'No hay tareas hechas'}
              description={
                activeStatus === 'open'
                  ? 'Cuando crees una nueva tarea aparecerá aquí.'
                  : 'Las tareas marcadas como hechas quedarán agrupadas en esta vista.'
              }
              action={
                activeStatus === 'open' ? (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className={operationalPrimaryButtonClass}
                  >
                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    Crear primera tarea
                  </button>
                ) : null
              }
            />
          </OperationalPanel>
        ) : null}

        {filteredTasks.map((task) => {
          const currentStatus = toUiStatus(task.status);
          const windowStartLabel = formatShortDay(task.window_start_date);
          const windowEndLabel = formatShortDay(task.due_date ?? null);
          return (
            <OperationalPanel key={task.id} className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#6f5434]/65 bg-[#3a2a1b]/60 text-[#e0aa69]">
                    <ClipboardDocumentListIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-lg font-semibold leading-tight text-[#f6f0e8]">{task.title}</p>
                    {task.description ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[#b9aea1]">{task.description}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <OperationalPill tone={priorityTone[task.priority]}>
                        Prioridad: {priorityLabels[task.priority]}
                      </OperationalPill>
                      {windowStartLabel && task.due_date ? (
                        <OperationalPill tone="muted">
                          <CalendarDaysIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Ventana: {windowStartLabel} - {windowEndLabel ?? task.due_date}
                        </OperationalPill>
                      ) : task.due_date ? (
                        <OperationalPill tone="muted">
                          <CalendarDaysIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Límite: {task.due_date}
                        </OperationalPill>
                      ) : null}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={updatingId === task.id}
                  onClick={() => handleStatusChange(task)}
                  className={operationalSecondaryButtonClass}
                >
                  <CheckIcon className="h-4 w-4" aria-hidden="true" />
                  {updatingId === task.id
                    ? 'Actualizando...'
                    : currentStatus === 'open'
                      ? 'Marcar como hecha'
                      : 'Reabrir'}
                </button>
              </div>
            </OperationalPanel>
          );
        })}
      </div>
    </div>
  );
}
