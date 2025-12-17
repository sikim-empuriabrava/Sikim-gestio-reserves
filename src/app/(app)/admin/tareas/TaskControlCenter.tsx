'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type TaskStatus = 'open' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'normal' | 'high';
type TaskArea = 'kitchen' | 'maintenance';

type Task = {
  id: string;
  area: TaskArea;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by_email?: string | null;
};

type Filters = {
  area: TaskArea | 'all';
  status: TaskStatus | 'all';
  dueDate: 'any' | 'today' | 'week';
};

type Summary = Record<
  TaskArea,
  {
    open: number;
    in_progress: number;
    done: number;
  }
>;

const areaLabels: Record<TaskArea, string> = {
  kitchen: 'Cocina',
  maintenance: 'Mantenimiento',
};

const statusLabels: Record<TaskStatus, string> = {
  open: 'Abierta',
  in_progress: 'En curso',
  done: 'Hecha',
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
};

const statusBadges: Record<TaskStatus, string> = {
  open: 'bg-slate-800 text-slate-100 border-slate-700',
  in_progress: 'bg-amber-900/50 text-amber-100 border-amber-800',
  done: 'bg-emerald-900/40 text-emerald-200 border-emerald-800',
};

const priorityBadges: Record<TaskPriority, string> = {
  low: 'bg-emerald-900/40 text-emerald-200 border-emerald-800',
  normal: 'bg-slate-800 text-slate-100 border-slate-700',
  high: 'bg-amber-900/50 text-amber-100 border-amber-800',
};

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekEndISO() {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 6);
  return weekEnd.toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

function sortTasks(tasks: Task[]) {
  const todayISO = getTodayISO();
  return [...tasks].sort((a, b) => {
    const aOverdue = Boolean(a.due_date && a.due_date < todayISO && a.status !== 'done');
    const bOverdue = Boolean(b.due_date && b.due_date < todayISO && b.status !== 'done');

    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
    }

    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }

    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;

    if (a.created_at && b.created_at && a.created_at !== b.created_at) {
      return b.created_at.localeCompare(a.created_at);
    }

    return 0;
  });
}

export function TaskControlCenter() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<Filters>({ area: 'all', status: 'all', dueDate: 'any' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setActionError(null);
    try {
      const response = await fetch('/api/tasks', { cache: 'no-store' });
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar las tareas');
      }

      setTasks(sortTasks(payload ?? []));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    const todayISO = getTodayISO();
    const weekEndISO = getWeekEndISO();

    const matchesDueDate = (task: Task) => {
      if (filters.dueDate === 'any') return true;
      if (!task.due_date) return false;

      if (filters.dueDate === 'today') {
        return task.due_date === todayISO;
      }

      return task.due_date >= todayISO && task.due_date <= weekEndISO;
    };

    return sortTasks(
      tasks.filter((task) => {
        const matchesArea = filters.area === 'all' ? true : task.area === filters.area;
        const matchesStatus = filters.status === 'all' ? true : task.status === filters.status;

        return matchesArea && matchesStatus && matchesDueDate(task);
      })
    );
  }, [filters, tasks]);

  const summary: Summary = useMemo(
    () =>
      tasks.reduce<Summary>(
        (acc, task) => {
          acc[task.area][task.status] += 1;
          return acc;
        },
        {
          kitchen: { open: 0, in_progress: 0, done: 0 },
          maintenance: { open: 0, in_progress: 0, done: 0 },
        }
      ),
    [tasks]
  );

  const overdueCount = useMemo(() => {
    const todayISO = getTodayISO();
    return tasks.filter((task) => task.due_date && task.due_date < todayISO && task.status !== 'done').length;
  }, [tasks]);

  const handleUpdate = async (taskId: string, updates: Partial<Pick<Task, 'status' | 'priority'>>) => {
    setUpdatingId(taskId);
    setActionError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo actualizar la tarea');
      }

      setTasks((prev) => sortTasks(prev.map((task) => (task.id === taskId ? { ...task, ...payload } : task))));
      setLastUpdated(new Date());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar la tarea');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {(['kitchen', 'maintenance'] as TaskArea[]).map((area) => (
          <div key={area} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span className="font-semibold text-slate-200">{areaLabels[area]}</span>
              <span>{tasks.filter((task) => task.area === area).length} tareas</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {(Object.keys(statusLabels) as TaskStatus[]).map((status) => (
                <div key={status} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{statusLabels[status]}</p>
                  <p className="text-lg font-semibold text-white">{summary[area][status]}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-semibold text-slate-200">Vencidas</p>
          <p className="text-3xl font-bold text-amber-200">{overdueCount}</p>
          <p className="text-xs text-slate-400">Tareas con fecha límite pasada y pendientes</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-white">Tareas</p>
            <p className="text-sm text-slate-400">
              Filtros rápidos para revisar tareas por área, estado y fecha de vencimiento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-200">
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Área</span>
              <select
                value={filters.area}
                onChange={(event) => setFilters((prev) => ({ ...prev, area: event.target.value as Filters['area'] }))}
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5"
              >
                <option value="all">Todas</option>
                <option value="kitchen">Cocina</option>
                <option value="maintenance">Mantenimiento</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Estado</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as Filters['status'] }))}
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5"
              >
                <option value="all">Todos</option>
                <option value="open">Abiertas</option>
                <option value="in_progress">En curso</option>
                <option value="done">Hechas</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Fecha</span>
              <select
                value={filters.dueDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, dueDate: event.target.value as Filters['dueDate'] }))}
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5"
              >
                <option value="any">Cualquiera</option>
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => loadTasks()}
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 font-semibold hover:border-slate-500"
            >
              Refrescar
            </button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-slate-400">Cargando tareas...</p>}
        {error && <p className="text-sm text-amber-200">{error}</p>}
        {actionError && <p className="text-sm text-amber-200">{actionError}</p>}

        {!isLoading && filteredTasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 p-6 text-sm text-slate-300">
            No hay tareas que coincidan con los filtros seleccionados.
          </div>
        )}

        {!isLoading && filteredTasks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Área</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Prioridad</th>
                  <th className="px-3 py-2">Vence</th>
                  <th className="px-3 py-2">Creada</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="text-slate-100">
                    <td className="px-3 py-3 align-top">
                      <div className="space-y-1">
                        <p className="font-semibold">{task.title}</p>
                        {task.description && <p className="text-xs text-slate-400">{task.description}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200">
                        {areaLabels[task.area]}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusBadges[task.status]}`}>
                        {statusLabels[task.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${priorityBadges[task.priority]}`}>
                        {priorityLabels[task.priority]}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-200">
                      <div className="space-y-1 text-xs">
                        <p>{formatDate(task.due_date)}</p>
                        {task.due_date && task.due_date < getTodayISO() && task.status !== 'done' && (
                          <span className="text-amber-200">Vencida</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-400">{formatDate(task.created_at)}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-col gap-2 text-xs text-slate-200">
                        <label className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Estado</span>
                          <select
                            value={task.status}
                            disabled={updatingId === task.id}
                            onChange={(event) => handleUpdate(task.id, { status: event.target.value as TaskStatus })}
                            className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1"
                          >
                            <option value="open">Abierta</option>
                            <option value="in_progress">En curso</option>
                            <option value="done">Hecha</option>
                          </select>
                        </label>

                        <label className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Prioridad</span>
                          <select
                            value={task.priority}
                            disabled={updatingId === task.id}
                            onChange={(event) => handleUpdate(task.id, { priority: event.target.value as TaskPriority })}
                            className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1"
                          >
                            <option value="low">Baja</option>
                            <option value="normal">Normal</option>
                            <option value="high">Alta</option>
                          </select>
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {lastUpdated
              ? `Actualizado ${lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
              : 'A la espera de la primera carga...'}
          </span>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setFilters({ area: 'all', status: 'all', dueDate: 'any' });
            }}
            className="text-emerald-200 hover:text-emerald-100 disabled:opacity-50"
          >
            Reiniciar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
