'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type RoutineArea = 'kitchen' | 'maintenance';
type RoutinePriority = 'low' | 'normal' | 'high';

type RoutinePack = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  auto_generate: boolean;
  area: RoutineArea | null;
};

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
  routine_pack_id: string | null;
};

type Filters = {
  area: RoutineArea | 'all';
  status: 'all' | 'active' | 'inactive';
};

type ModalMode = 'create' | 'edit';
type PackModalMode = 'create' | 'edit';

type FormState = {
  area: RoutineArea;
  title: string;
  description: string;
  start_day_of_week: number;
  end_day_of_week: number;
  priority: RoutinePriority;
  is_active: boolean;
};

type PackFormState = {
  name: string;
  description: string;
  enabled: boolean;
  auto_generate: boolean;
  area: RoutineArea | '';
};

type GenerationResult = {
  created: number;
  skipped: number;
  scope?: 'pack' | 'all';
};

const NO_PACK_ID = 'none';

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

function buildDefaultForm(area: RoutineArea = 'maintenance'): FormState {
  return {
    area,
    title: '',
    description: '',
    start_day_of_week: 1,
    end_day_of_week: 1,
    priority: 'normal',
    is_active: true,
  };
}

function buildDefaultPackForm(): PackFormState {
  return {
    name: '',
    description: '',
    enabled: false,
    auto_generate: false,
    area: '',
  };
}

function getRoutineStartDay(routine: Routine) {
  return routine.start_day_of_week ?? routine.end_day_of_week ?? routine.day_of_week;
}

function getRoutineEndDay(routine: Routine) {
  return routine.end_day_of_week ?? routine.day_of_week ?? getRoutineStartDay(routine);
}

export function WeeklyRoutinesManager() {
  const [routinePacks, setRoutinePacks] = useState<RoutinePack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string>(NO_PACK_ID);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [packActionError, setPackActionError] = useState<string | null>(null);
  const [packModalMode, setPackModalMode] = useState<PackModalMode | null>(null);
  const [editingPack, setEditingPack] = useState<RoutinePack | null>(null);
  const [packFormState, setPackFormState] = useState<PackFormState>(buildDefaultPackForm());
  const [packSubmitting, setPackSubmitting] = useState(false);
  const [packUpdatingId, setPackUpdatingId] = useState<string | null>(null);

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
  const [generationLoading, setGenerationLoading] = useState<'pack' | 'all' | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [routineToast, setRoutineToast] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPack = useMemo(
    () => routinePacks.find((pack) => pack.id === selectedPackId) ?? null,
    [routinePacks, selectedPackId]
  );

  const loadRoutinePacks = useCallback(async () => {
    setPacksLoading(true);
    setPacksError(null);
    setPackActionError(null);
    try {
      const response = await fetch('/api/routine-packs', { cache: 'no-store' });
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar los packs');
      }

      setRoutinePacks(payload ?? []);

      if (selectedPackId !== NO_PACK_ID && !(payload ?? []).some((pack: RoutinePack) => pack.id === selectedPackId)) {
        setSelectedPackId(NO_PACK_ID);
      }
    } catch (err) {
      setPacksError(err instanceof Error ? err.message : 'Error al cargar los packs');
    } finally {
      setPacksLoading(false);
    }
  }, [selectedPackId]);

  const loadRoutines = useCallback(
    async (packId: string = selectedPackId) => {
      setIsLoading(true);
      setError(null);
      setActionError(null);
      try {
        const query = `?pack_id=${packId}`;
        const response = await fetch(`/api/routines${query}`, { cache: 'no-store' });
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
    },
    [selectedPackId]
  );

  useEffect(() => {
    loadRoutinePacks();
  }, [loadRoutinePacks]);

  useEffect(() => {
    loadRoutines(selectedPackId);
  }, [loadRoutines, selectedPackId]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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
    setFormState(buildDefaultForm(selectedPack?.area ?? 'maintenance'));
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
    setFormState(buildDefaultForm(selectedPack?.area ?? 'maintenance'));
  };

  const openCreatePackModal = () => {
    setEditingPack(null);
    setPackFormState(buildDefaultPackForm());
    setPackModalMode('create');
    setPackActionError(null);
  };

  const openEditPackModal = (pack: RoutinePack) => {
    setEditingPack(pack);
    setPackFormState({
      name: pack.name,
      description: pack.description ?? '',
      enabled: pack.enabled,
      auto_generate: pack.auto_generate,
      area: pack.area ?? '',
    });
    setPackModalMode('edit');
    setPackActionError(null);
  };

  const closePackModal = () => {
    setEditingPack(null);
    setPackModalMode(null);
    setPackFormState(buildDefaultPackForm());
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
        payload.routine_pack_id = selectedPackId === NO_PACK_ID ? null : selectedPackId;
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

      await loadRoutines(selectedPackId);
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

  const handleGenerateWeek = async (scope: 'pack' | 'all') => {
    setGenerationLoading(scope);
    setGenerationError(null);
    setGenerationResult(null);

    const payload =
      scope === 'pack'
        ? { week_start: weekStart, pack_id: selectedPackId === NO_PACK_ID ? NO_PACK_ID : selectedPackId }
        : { week_start: weekStart };

    try {
      const response = await fetch('/api/routines/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseBody?.error || 'No se pudieron generar las tareas');
      }

      setGenerationResult(responseBody as GenerationResult);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'No se pudieron generar las tareas');
    } finally {
      setGenerationLoading(null);
    }
  };

  const handleDeletePack = async (pack: RoutinePack) => {
    if (!window.confirm('¿Eliminar pack? Solo se puede si no tiene rutinas.')) return;

    setPackActionError(null);
    setPackUpdatingId(pack.id);
    try {
      const response = await fetch(`/api/routine-packs/${pack.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));

      if (response.status === 409) {
        throw new Error('No se puede borrar: el pack tiene rutinas. Borra o mueve las rutinas primero.');
      }

      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo borrar el pack');
      }

      await loadRoutinePacks();

      if (selectedPackId === pack.id) {
        setSelectedPackId(NO_PACK_ID);
      }
    } catch (err) {
      setPackActionError(err instanceof Error ? err.message : 'No se pudo borrar el pack');
    } finally {
      setPackUpdatingId(null);
    }
  };

  const handleDeleteRoutine = async (routine: Routine) => {
    if (
      !window.confirm(
        '¿Eliminar rutina? Las tareas ya generadas quedarán como tareas normales (sin vínculo a rutina).'
      )
    ) {
      return;
    }

    setActionError(null);
    setUpdatingId(routine.id);
    try {
      const response = await fetch(`/api/routines/${routine.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo borrar la rutina');
      }

      await loadRoutines(selectedPackId);

      const unlinkedTasks = Number(body?.unlinked_tasks ?? 0);
      const message = `Rutina eliminada. Tareas desvinculadas: ${unlinkedTasks}.`;

      setRoutineToast(message);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setRoutineToast(null);
      }, 4000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo borrar la rutina');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTogglePack = async (pack: RoutinePack, field: 'enabled' | 'auto_generate') => {
    setPackUpdatingId(pack.id);
    setPackActionError(null);
    try {
      const response = await fetch(`/api/routine-packs/${pack.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !pack[field] }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo actualizar el pack');
      }

      setRoutinePacks((prev) => prev.map((item) => (item.id === pack.id ? { ...item, ...payload } : item)));
    } catch (err) {
      setPackActionError(err instanceof Error ? err.message : 'No se pudo actualizar el pack');
    } finally {
      setPackUpdatingId(null);
    }
  };

  const handlePackSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!packModalMode) return;

    if (!packFormState.name.trim()) {
      setPackActionError('El nombre es obligatorio');
      return;
    }

    setPackSubmitting(true);
    setPackActionError(null);

    try {
      const payload = {
        name: packFormState.name.trim(),
        description: packFormState.description.trim() || null,
        enabled: packFormState.enabled,
        auto_generate: packFormState.auto_generate,
        area: packFormState.area || null,
      };

      let url = '/api/routine-packs';
      let method: 'POST' | 'PATCH' = 'POST';

      if (packModalMode === 'edit') {
        if (!editingPack) {
          setPackSubmitting(false);
          setPackActionError('No se encontró el pack a editar');
          return;
        }
        url = `/api/routine-packs/${editingPack.id}`;
        method = 'PATCH';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar el pack');
      }

      await loadRoutinePacks();

      if (method === 'POST' && body?.id) {
        setSelectedPackId(body.id as string);
      }

      closePackModal();
    } catch (err) {
      setPackActionError(err instanceof Error ? err.message : 'No se pudo guardar el pack');
    } finally {
      setPackSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-white">Packs de rutinas</p>
              <p className="text-sm text-slate-400">
                Agrupa plantillas por pack y decide si se generan automáticamente cada semana.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreatePackModal}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
            >
              + Nuevo pack
            </button>
          </div>

          {packsLoading && <p className="text-sm text-slate-400">Cargando packs…</p>}
          {packsError && <p className="text-sm text-amber-200">{packsError}</p>}
          {packActionError && <p className="text-sm text-amber-200">{packActionError}</p>}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSelectedPackId(NO_PACK_ID)}
              className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                selectedPackId === NO_PACK_ID
                  ? 'border-emerald-500 bg-slate-800/70 text-white'
                  : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Sin pack</p>
                  <p className="text-xs text-slate-400">Rutinas sueltas sin pack asignado.</p>
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200">
                  Libre
                </span>
              </div>
            </button>

            {!packsLoading && routinePacks.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
                Todavía no hay packs creados. Pulsa &quot;Nuevo pack&quot; para empezar.
              </div>
            )}

            {routinePacks.map((pack) => {
              const isSelected = pack.id === selectedPackId;
              return (
                <div
                  key={pack.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPackId(pack.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      setSelectedPackId(pack.id);
                    }
                  }}
                  className={`rounded-lg border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isSelected
                      ? 'border-emerald-500 bg-slate-800/70 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold">{pack.name}</p>
                      {pack.description && <p className="text-xs text-slate-400">{pack.description}</p>}
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                        <span className="rounded-full bg-slate-800 px-2 py-1 font-semibold">
                          {pack.area ? areaLabels[pack.area] : 'Área libre'}
                        </span>
                        {!pack.enabled && (
                          <span className="rounded-full bg-slate-800 px-2 py-1 font-semibold text-amber-200">
                            Pausado
                          </span>
                        )}
                        {pack.auto_generate && (
                          <span className="rounded-full bg-emerald-900/40 px-2 py-1 font-semibold text-emerald-100">
                            Auto
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditPackModal(pack);
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-slate-500"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={packUpdatingId === pack.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeletePack(pack);
                        }}
                        className="rounded-lg border border-rose-500/70 bg-rose-950/40 px-3 py-1 text-xs font-semibold text-rose-100 hover:border-rose-400 disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-200">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pack.enabled}
                        disabled={packUpdatingId === pack.id}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleTogglePack(pack, 'enabled');
                        }}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>Enabled</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pack.auto_generate}
                        disabled={packUpdatingId === pack.id}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleTogglePack(pack, 'auto_generate');
                        }}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>Auto</span>
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Enabled controla si se genera manual/auto. Auto solo afecta al cron.
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-white">
                  Rutinas del pack {selectedPack ? `"${selectedPack.name}"` : 'sin pack'}
                </p>
                <p className="text-sm text-slate-400">
                  Solo ves las rutinas del pack seleccionado. Las nuevas se asignarán automáticamente al pack activo.
                </p>
                {selectedPack && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full bg-slate-800 px-2 py-1 font-semibold">
                      {selectedPack.area ? areaLabels[selectedPack.area] : 'Área libre'}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-1 font-semibold">
                      {selectedPack.enabled ? 'Enabled' : 'Pausado'}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-1 font-semibold">
                      {selectedPack.auto_generate ? 'Auto semanal' : 'Manual'}
                    </span>
                  </div>
                )}
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
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, status: event.target.value as Filters['status'] }))
                  }
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
                  loadRoutines(selectedPackId);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 font-semibold hover:border-slate-500"
              >
                Reset filtros
              </button>
            </div>

            {isLoading && <p className="text-sm text-slate-400">Cargando rutinas…</p>}
            {error && <p className="text-sm text-amber-200">{error}</p>}
            {actionError && <p className="text-sm text-amber-200">{actionError}</p>}
            {routineToast && <p className="text-sm text-emerald-200">{routineToast}</p>}

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
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(routine)}
                                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-slate-500"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={updatingId === routine.id}
                                onClick={() => handleDeleteRoutine(routine)}
                                className="rounded-lg border border-rose-500/70 bg-rose-950/40 px-3 py-1 text-xs font-semibold text-rose-100 hover:border-rose-400 disabled:opacity-60"
                              >
                                Eliminar
                              </button>
                            </div>
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
                onClick={() => loadRoutines(selectedPackId)}
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
                &quot;Generar para este pack&quot; solo afecta al pack visible. &quot;Generar todo&quot; crea tareas para
                todos los packs habilitados y rutinas sin pack.
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
                onClick={() => handleGenerateWeek('pack')}
                disabled={generationLoading !== null}
                className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-60"
              >
                {generationLoading === 'pack'
                  ? 'Generando…'
                  : selectedPackId === NO_PACK_ID
                  ? 'Generar sin pack'
                  : 'Generar para este pack'}
              </button>
              <button
                type="button"
                onClick={() => handleGenerateWeek('all')}
                disabled={generationLoading !== null}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-60"
              >
                {generationLoading === 'all' ? 'Generando…' : 'Generar todo (packs habilitados + sin pack)'}
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

      {packModalMode && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-10">
          <div className="w-full max-w-2xl space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {packModalMode === 'create' ? 'Nuevo pack' : 'Editar pack'}
                </p>
                <h3 className="text-xl font-semibold text-slate-100">
                  {packModalMode === 'create' ? 'Crear pack de rutinas' : editingPack?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={closePackModal}
                className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={handlePackSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Nombre</span>
                  <input
                    type="text"
                    value={packFormState.name}
                    onChange={(event) => setPackFormState((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                    placeholder="Nombre del pack"
                    required
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Área (opcional)</span>
                  <select
                    value={packFormState.area}
                    onChange={(event) =>
                      setPackFormState((prev) => ({ ...prev, area: event.target.value as RoutineArea | '' }))
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                  >
                    <option value="">Sin área fija</option>
                    <option value="kitchen">Cocina</option>
                    <option value="maintenance">Mantenimiento</option>
                  </select>
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-200">
                <span className="block font-semibold">Descripción</span>
                <textarea
                  value={packFormState.description}
                  onChange={(event) => setPackFormState((prev) => ({ ...prev, description: event.target.value }))}
                  className="h-24 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-600 focus:outline-none"
                  placeholder="¿Qué cubre este pack?"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={packFormState.enabled}
                    onChange={(event) => setPackFormState((prev) => ({ ...prev, enabled: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Enabled</span>
                </label>

                <div className="space-y-1 text-sm text-slate-200">
                  <label className="flex items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={packFormState.auto_generate}
                      onChange={(event) =>
                        setPackFormState((prev) => ({ ...prev, auto_generate: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Auto</span>
                  </label>
                  <p className="text-xs font-normal text-slate-400">
                    Enabled controla si se genera manual/auto. Auto solo afecta al cron.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                {packActionError && <p className="text-amber-200">{packActionError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closePackModal}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-semibold text-slate-100 hover:border-slate-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={packSubmitting}
                    className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {packSubmitting ? 'Guardando…' : 'Guardar'}
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
