'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { TodayGroupEvent } from '@/app/(app)/cocina/types';

type TaskArea = 'kitchen' | 'maintenance';
type TaskPriority = 'low' | 'normal' | 'high';

type Props = {
  reservation: TodayGroupEvent;
  onCreated?: (area: TaskArea) => void;
};

type ModalState = {
  area: TaskArea;
};

type Feedback = {
  area: TaskArea;
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
};

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(time: string | null) {
  if (!time) return '—';
  return time.slice(0, 5);
}

function buildDefaultTitle(reservation: TodayGroupEvent, area: TaskArea) {
  const time = formatTime(reservation.entry_time);
  const areaLabel = area === 'kitchen' ? 'Cocina' : 'Mantenimiento';
  return `[${areaLabel}] Reserva ${time} – ${reservation.name}`;
}

function buildDescription(reservation: TodayGroupEvent) {
  const totalPax = reservation.total_pax ?? (reservation.adults ?? 0) + (reservation.children ?? 0);
  const hasPaxInfo =
    reservation.total_pax !== null && reservation.total_pax !== undefined
      ? true
      : reservation.adults !== null || reservation.children !== null;

  const descriptionParts: string[] = [];

  if (reservation.entry_time) {
    descriptionParts.push(`Hora: ${formatTime(reservation.entry_time)}`);
  }

  if (reservation.name?.trim()) {
    descriptionParts.push(`Nombre: ${reservation.name.trim()}`);
  }

  if (hasPaxInfo) {
    descriptionParts.push(
      `Pax: adultos ${reservation.adults ?? 0}, niños ${reservation.children ?? 0}, total ${totalPax}`
    );
  }

  if (reservation.status?.trim()) {
    descriptionParts.push(`Estado: ${reservation.status.trim()}`);
  }

  if (reservation.menu_text?.trim()) {
    descriptionParts.push(`Menú: ${reservation.menu_text.trim()}`);
  }

  if (reservation.seconds_confirmed !== null && reservation.seconds_confirmed !== undefined) {
    descriptionParts.push(`Segundos confirmados: ${reservation.seconds_confirmed ? 'Sí' : 'No'}`);
  }

  if (reservation.allergens_and_diets?.trim()) {
    descriptionParts.push(`Alergias/dietas: ${reservation.allergens_and_diets.trim()}`);
  }

  if (reservation.extras?.trim()) {
    descriptionParts.push(`Extras: ${reservation.extras.trim()}`);
  }

  if (reservation.has_private_dining_room) {
    descriptionParts.push('Sala privada: Sí');
  }

  if (reservation.has_private_party) {
    descriptionParts.push('Fiesta privada: Sí');
  }

  return descriptionParts.join('\n');
}

export function CreateTaskFromReservation({ reservation, onCreated }: Props) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!modal) return;

    setTitle(buildDefaultTitle(reservation, modal.area));
    setDescription(buildDescription(reservation));
    setPriority('normal');
    setDueDate(reservation.event_date || toISODate(new Date()));
    setError(null);
  }, [modal, reservation]);

  const areaLabel = useMemo(() => {
    if (!modal) return '';
    return modal.area === 'kitchen' ? 'Cocina' : 'Mantenimiento';
  }, [modal]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: modal.area,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_date: dueDate || null,
          source: {
            type: 'group_event',
            id: reservation.id,
            event_date: reservation.event_date,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo crear la tarea');
      }

      setFeedback({ area: modal.area });
      onCreated?.(modal.area);
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-primary-100 shadow-sm hover:border-slate-700"
            onClick={() => setModal({ area: 'kitchen' })}
          >
            + Tarea Cocina
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-amber-100 shadow-sm hover:border-slate-700"
            onClick={() => setModal({ area: 'maintenance' })}
          >
            + Tarea Mantenimiento
          </button>
        </div>

      {feedback && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-600/50 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-100">
          <span>Tarea creada ✅</span>
          <Link
            href={feedback.area === 'kitchen' ? '/cocina/tareas' : '/mantenimiento/tareas'}
            className="font-semibold underline underline-offset-2"
          >
            Ver tareas
          </Link>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-emerald-100/80 hover:text-emerald-50"
          >
            Cerrar
          </button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-10">
          <div className="w-full max-w-2xl space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Crear tarea</p>
                <h3 className="text-xl font-semibold text-slate-100">{areaLabel}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Área</span>
                  <input
                    type="text"
                    value={modal.area === 'kitchen' ? 'Cocina' : 'Mantenimiento'}
                    readOnly
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block font-semibold">Fecha límite</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-200">
                <span className="block font-semibold">Título</span>
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-200">
                <span className="block font-semibold">Descripción</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
                />
              </label>

              <div className="space-y-2 text-sm text-slate-200">
                <span className="block font-semibold">Prioridad</span>
                <div className="flex flex-wrap gap-2">
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
              </div>

              {error && (
                <p className="text-sm text-amber-200">{error}</p>
              )}

              <div className="flex flex-wrap gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModal(null)}
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
