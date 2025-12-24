'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type RoutineArea = 'kitchen' | 'maintenance';
type RoutinePriority = 'low' | 'normal' | 'high';

type Routine = {
  id: string;
  area: RoutineArea;
  title: string;
  description: string | null;
  day_of_week: number;
  start_day_of_week?: number | null;
  end_day_of_week?: number | null;
  priority: RoutinePriority;
  is_active: boolean;
};

type Filters = {
  area: RoutineArea | 'all';
  status: 'all' | 'active' | 'inactive';
};

type ModalMode = 'create' | 'edit';

type FormState = {
  area: RoutineArea;
  title: string;
  description: string;
  start_day_of_week: number;
  end_day_of_week: number;
  priority: RoutinePriority;
  is_active: boolean;
};

type GenerationResult = {
  created: number;
  skipped: number;
};

const areaLabels: Record<RoutineArea, string> = {
  kitchen: 'Cocina',
  maintenance: 'Mantenimiento',
};

const priorityLabels: Record<RoutinePriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
};

const priorityBadges: Record<RoutinePriority, string> = {
  low: 'bg-emerald-900/40 text-emerald-200 border-emerald-800',
  normal: 'bg-slate-800 text-slate-100 border-slate-700',
  high: 'bg-amber-900/50 text-amber-100 border-amber-800',
};

const dayOptions = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

function getCurrentWeekMonday() {
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = utcDate.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utcDate.setUTCDate(utcDate.getUTCDate() + diff);
  return utcDate.toISOString().slice(0, 10);
}

function getDayLabel(value: number) {
  const match = dayOptions.find((option) => option.value === value);
  if (!match) return `Día ${value}`;
  return match.label.slice(0, 3);
}

function buildDefaultForm(): FormState {
  return {
    area: 'maintenance',
    title: '',
    description: '',
    start_day_of_week: 1,
    end_day_of_week: 1,
    priority: 'normal',
    is_active: true,
  };
}

function getRoutineStartDay(routine: Routine) {
  return routine.start_day_of_week ?? routine.end_day_of_week ?? routine.day_of_week;
}

function getRoutineEndDay(routine: Routine) {
  return routine.end_day_of_week ?? routine.day_of_week ?? getRoutineStartDay(routine);
}

export function WeeklyRoutinesManager() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [filters, setFilters] = useState<Filters>({ area: 'all', status: 'active' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [formState, setFormState] = useState<FormState>(buildDefaultForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [weekStart, setWeekStart] = useState(getCurrentWeekMonday());
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadRoutines = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setActionError(null);
    try {
      const response = await fetch('/api/routines', { cache: 'no-store' });
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar las rutinas');
      }

      setRoutines(payload ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las rutinas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  const filteredRoutines = useMemo(() => {
    return routines.filter((routine) => {
      const matchesArea = filters.area === 'all' ? true : routine.area === filters.area;
      const matchesStatus =
        filters.status === 'all'
          ? true
          : filters.status === 'active'
          ? routine.is_active
          : !routine.is_active;

      return matchesArea && matchesStatus;
    });
  }, [filters.area, filters.status, routines]);

  const openCreateModal = () => {
    setEditingRoutine(null);
    setFormState(buildDefaultForm());
    setModalMode('create');
    setActionError(null);
  };

  const openEditModal = (routine: Routine) => {
    setEditingRoutine(routine);
    setFormState({
      area: routine.area,
      title: routine.title,
      description: routine.description ?? '',
      start_day_of_week: getRoutineStartDay(routine),
      end_day_of_week: getRoutineEndDay(routine),
      priority: routine.priority,
      is_active: routine.is_active,
    });
    setModalMode('edit');
    setActionError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingRoutine(null);
    setFormState(buildDefaultForm());
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modalMode) return;

    if (formState.start_day_of_week > formState.end_day_of_week) {
      setActionError('El día de inicio no puede ser mayor que el día de fin');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim() || null,
        start_day_of_week: formState.start_day_of_week,
        end_day_of_week: formState.end_day_of_week,
        day_of_week: formState.end_day_of_week,
        priority: formState.priority,
        is_active: formState.is_active,
      } as Record<string, string | number | boolean | null>;

      let url = '/api/routines';
      let method: 'POST' | 'PATCH' = 'POST';

      if (modalMode === 'create') {
        payload.area = formState.area;
      }

      if (modalMode === 'edit') {
        if (!editingRoutine) {
          setIsSubmitting(false);
          setActionError('No se encontró la rutina a editar');
          return;
        }
        url = `/api/routines/${editingRoutine.id}`;
        method = 'PATCH';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la rutina');
      }

      await loadRoutines();
      closeModal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar la rutina');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (routine: Routine) => {
    setUpdatingId(routine.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/routines/${routine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !routine.is_active }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo actualizar la rutina');
      }

      setRoutines((prev) => prev.map((item) => (item.id === routine.id ? { ...item, ...payload } : item)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar la rutina');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleGenerateWeek = async () => {
    setGenerationLoading(true);
    setGenerationError(null);
    setGenerationResult(null);

    try {
      const response = await fetch('/api/routines/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron generar las tareas');
      }

      setGenerationResult(payload as GenerationResult);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'No se pudieron generar las tareas');
    } finally {
      setGenerationLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-white">Listado de rutinas</p>
              <p className="text-sm text-slate-400">
                Filtra por área y estado, edita o desactiva rutinas sin perder el orden semanal.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
            >
              + Nueva rutina
            </button>
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
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
                <option value="all">Todas</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setFilters({ area: 'all', status: 'active' });
                loadRoutines();
              }}
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 font-semibold hover:border-slate-500"
            >
              Reset filtros
            </button>
          </div>

          {isLoading && <p className="text-sm text-slate-400">Cargando rutinas…</p>}
          {error && <p className="text-sm text-amber-200">{error}</p>}
          {actionError && <p className="text-sm text-amber-200">{actionError}</p>}

          {!isLoading && filteredRoutines.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 p-6 text-sm text-slate-300">
              No hay rutinas que coincidan con los filtros seleccionados.
            </div>
          )}

          {!isLoading && filteredRoutines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Ventana</th>
                    <th className="px-3 py-2">Área</th>
                    <th className="px-3 py-2">Título</th>
                    <th className="px-3 py-2">Prioridad</th>
                    <th className="px-3 py-2">Activa</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredRoutines.map((routine) => {
                    const startDay = getRoutineStartDay(routine);
                    const endDay = getRoutineEndDay(routine);
                    const windowLabel =
                      startDay === endDay
                        ? getDayLabel(endDay)
                        : `${getDayLabel(startDay)} → ${getDayLabel(endDay)}`;

                    return (
                      <tr key={routine.id} className="text-slate-100">
                        <td className="px-3 py-3 align-top">
                          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1 text-sm font-semibold text-white">
                            Ventana: {windowLabel}
                          </div>
                        </td>
                      <td className="px-3 py-3 align-top text-xs">
                        <span className="rounded-full bg-slate-800 px-2 py-1 font-semibold text-slate-200">
                          {areaLabels[routine.area]}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-1">
                          <p className="font-semibold">{routine.title}</p>
                          {routine.description && <p className="text-xs text-slate-400">{routine.description}</p>}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${priorityBadges[routine.priority]}`}
                        >
                          {priorityLabels[routine.priority]}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
                          <input
                            type="checkbox"
                            checked={routine.is_active}
                            disabled={updatingId === routine.id}
                            onChange={() => handleToggleActive(routine)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span>{routine.is_active ? 'Activa' : 'Inactiva'}</span>
                        </label>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => openEditModal(routine)}
                          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-slate-500"
                        >
                          Editar
                        </button>
                      </td>
                        </tr>
                    );
                  })}
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
              onClick={() => loadRoutines()}
              className="text-emerald-200 hover:text-emerald-100 disabled:opacity-50"
            >
              Refrescar
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-white">Generar tareas de la semana</p>
            <p className="text-sm text-slate-400">
              Selecciona el lunes de referencia y crea las tareas de esa semana solo para rutinas activas.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-200">
            <label className="space-y-2">
              <span className="block text-xs uppercase tracking-wide text-slate-400">Semana (lunes)</span>
              <input
                type="date"
                value={weekStart}
                onChange={(event) => setWeekStart(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={handleGenerateWeek}
              disabled={generationLoading}
              className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-60"
            >
              {generationLoading ? 'Generando…' : 'Generar tareas de esta semana'}
            </button>

            {generationResult && (
              <p className="text-sm text-emerald-200">
                Creadas {generationResult.created}, omitidas {generationResult.skipped}
              </p>
            )}
            {generationError && <p className="text-sm text-amber-200">{generationError}</p>}
          </div>
        </div>
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-10">
          <div className="w-full max-w-3xl space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {modalMode === 'create' ? 'Nueva rutina' : 'Editar rutina'}
                </p>
                <h3 className="text-xl font-semibold text-slate-100">
                  {modalMode === 'create' ? 'Añadir plantilla semanal' : editingRoutine?.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Área</span>
                  <select
                    value={formState.area}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, area: event.target.value as RoutineArea }))
                    }
                    disabled={modalMode === 'edit'}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                  >
                    <option value="kitchen">Cocina</option>
                    <option value="maintenance">Mantenimiento</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Empieza (día de la semana)</span>
                  <select
                    value={formState.start_day_of_week}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, start_day_of_week: Number(event.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                  >
                    {dayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Debe estar hecha antes de (día de la semana)</span>
                  <select
                    value={formState.end_day_of_week}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, end_day_of_week: Number(event.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                  >
                    {dayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Título</span>
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                    placeholder="Título de la tarea"
                    required
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Prioridad</span>
                  <select
                    value={formState.priority}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, priority: event.target.value as RoutinePriority }))
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                  >
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                  </select>
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-200">
                <span className="block font-semibold">Descripción</span>
                <textarea
                  value={formState.description}
                  onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                  className="h-32 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                  placeholder="Detalles de la rutina"
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <input
                  type="checkbox"
                  checked={formState.is_active}
                  onChange={(event) => setFormState((prev) => ({ ...prev, is_active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Rutina activa</span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                {actionError && <p className="text-amber-200">{actionError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-semibold text-slate-100 hover:border-slate-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
