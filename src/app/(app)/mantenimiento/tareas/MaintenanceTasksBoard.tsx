'use client';

import { useMemo, useState } from 'react';

type UiStatus = 'open' | 'done';
type TaskPriority = 'low' | 'normal' | 'high';

type Task = {
  id: string;
  area: string;
  title: string;
  description: string | null;
  status: string;
  priority: TaskPriority;
  routine_id?: string | null;
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

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/60',
  normal: 'bg-slate-800/60 text-slate-200 border-slate-700',
  high: 'bg-amber-900/40 text-amber-200 border-amber-700/80',
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

function getTaskType(task: Task) {
  return task.routine_id ? 'routine' : 'incident';
}

type Props = {
  initialTasks: Task[];
};

export function MaintenanceTasksBoard({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeStatus, setActiveStatus] = useState<UiStatus>('open');
  const [typeFilter, setTypeFilter] = useState<'all' | 'routine' | 'incident'>('all');
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
    () =>
      tasks.filter((task) => {
        const matchesStatus = toUiStatus(task.status) === activeStatus;
        const matchesType = typeFilter === 'all' ? true : getTaskType(task) === typeFilter;
        return matchesStatus && matchesType;
      }),
    [tasks, activeStatus, typeFilter]
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
          area: 'maintenance',
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-1 text-sm">
          {(Object.keys(statusLabels) as UiStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              className={`rounded-md px-3 py-2 font-medium transition ${
                activeStatus === status
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
              onClick={() => setActiveStatus(status)}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
          >
            {showForm ? 'Cerrar' : 'Nueva tarea'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-200">
        <span className="text-xs uppercase tracking-wide text-slate-400">Tipo</span>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100"
        >
          <option value="all">Todas</option>
          <option value="routine">Rutinas</option>
          <option value="incident">Incidencias</option>
        </select>
        <span className="ml-auto text-xs text-slate-400">
          {filteredTasks.length} tareas
        </span>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-200">
              <span className="block font-semibold">Título</span>
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
                placeholder="Descripción corta de la incidencia"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              <span className="block font-semibold">Fecha límite (opcional)</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-slate-200">
            <span className="block font-semibold">Descripción</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
              rows={3}
              placeholder="Detalles que ayuden a resolverla"
            />
          </label>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="space-y-2 text-sm text-slate-200">
              <span className="block font-semibold">Prioridad</span>
              <div className="flex gap-3">
                {(Object.keys(priorityLabels) as TaskPriority[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPriority(value)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                      priority === value
                        ? 'border-slate-300 bg-slate-100 text-slate-900'
                        : 'border-slate-700 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {priorityLabels[value]}
                  </button>
                ))}
              </div>
            </label>

            <div className="flex gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar tarea'}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-amber-200">{error}</p>}
          {message && <p className="text-sm text-emerald-300">{message}</p>}
        </form>
      )}

      {error && !showForm && <p className="text-sm text-amber-200">{error}</p>}
      {message && !showForm && <p className="text-sm text-emerald-300">{message}</p>}

      <div className="grid gap-3">
        {filteredTasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-300">
            No hay tareas en esta columna.
          </div>
        )}

        {filteredTasks.map((task) => {
          const currentStatus = toUiStatus(task.status);
          const windowStartLabel = formatShortDay(task.window_start_date);
          const windowEndLabel = formatShortDay(task.due_date ?? null);
          const taskType = getTaskType(task);
          return (
            <div key={task.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-100">{task.title}</p>
                  {task.description && (
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{task.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span
                      className={`rounded-full border px-2 py-1 font-semibold ${priorityStyles[task.priority]}`}
                    >
                      Prioridad: {priorityLabels[task.priority]}
                    </span>
                    <span className="rounded-full border border-slate-700 px-2 py-1 font-semibold text-slate-200">
                      Tipo: {taskType === 'routine' ? 'Rutina' : 'Incidencia'}
                    </span>
                    {windowStartLabel && task.due_date ? (
                      <span className="rounded-full bg-slate-800 px-2 py-1">
                        Ventana: {windowStartLabel} → {windowEndLabel ?? task.due_date}
                      </span>
                    ) : (
                      task.due_date && (
                        <span className="rounded-full bg-slate-800 px-2 py-1">Límite: {task.due_date}</span>
                      )
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={updatingId === task.id}
                  onClick={() => handleStatusChange(task)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingId === task.id
                    ? 'Actualizando...'
                    : currentStatus === 'open'
                      ? 'Marcar como hecha'
                      : 'Reabrir'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
