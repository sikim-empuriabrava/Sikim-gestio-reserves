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

const actionButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-[#5b4934]/80 bg-[#171512]/90 px-3.5 py-2 text-sm font-semibold text-[#efe8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9b7548]/70 hover:bg-[#24211d] hover:text-[#ffe2b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/35 active:translate-y-px';

const labelClass = 'space-y-2 text-sm text-[#d8cfc2]';

const fieldClass =
  'w-full rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3 py-2 text-sm text-[#f4ede3] placeholder:text-[#786f64] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15 disabled:cursor-not-allowed disabled:opacity-70';

const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 px-4 py-2 text-sm font-semibold text-[#efe8dc] transition duration-200 hover:border-[#8b6a43]/70 hover:bg-[#211f1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/35 active:translate-y-px';

const primaryButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-[#d6a76e]/60 bg-[#d9b27c] px-4 py-2 text-sm font-bold text-[#19120b] shadow-[0_18px_40px_-28px_rgba(214,167,110,0.9)] transition duration-200 hover:border-[#efca92]/75 hover:bg-[#e4bf89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/35 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60';

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
            className={actionButtonClass}
            onClick={() => setModal({ area: 'kitchen' })}
          >
            + Tarea Cocina
          </button>
          <button
            type="button"
            className={actionButtonClass}
            onClick={() => setModal({ area: 'maintenance' })}
          >
            + Tarea Mantenimiento
          </button>
        </div>

      {feedback && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <span>Tarea creada</span>
          <Link
            href={feedback.area === 'kitchen' ? '/cocina/tareas' : '/mantenimiento/tareas'}
            className="font-semibold text-[#f0c58b] underline underline-offset-2 hover:text-[#ffe2b6]"
          >
            Ver tareas
          </Link>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-medium text-emerald-100/80 transition hover:text-emerald-50"
          >
            Cerrar
          </button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#080705]/75 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl space-y-6 rounded-2xl border border-[#5b4934]/75 bg-[#181715] p-6 text-[#efe8dc] shadow-[0_28px_90px_-48px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c99a61]">Crear tarea</p>
                <h3 className="mt-1 text-xl font-semibold text-[#f6f0e8]">{areaLabel}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className={secondaryButtonClass}
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  <span className="block font-semibold">Área</span>
                  <input
                    type="text"
                    value={modal.area === 'kitchen' ? 'Cocina' : 'Mantenimiento'}
                    readOnly
                    className={`${fieldClass} text-[#cfc4b5]`}
                  />
                </label>
                <label className={labelClass}>
                  <span className="block font-semibold">Fecha límite</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                <span className="block font-semibold">Título</span>
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={fieldClass}
                />
              </label>

              <label className={labelClass}>
                <span className="block font-semibold">Descripción</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  className={fieldClass}
                />
              </label>

              <div className="space-y-2 text-sm text-[#d8cfc2]">
                <span className="block font-semibold">Prioridad</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(priorityLabels) as TaskPriority[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPriority(value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/35 active:translate-y-px ${
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

              {error && (
                <p className="text-sm text-amber-200">{error}</p>
              )}

              <div className="flex flex-wrap gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className={secondaryButtonClass}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className={primaryButtonClass}
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
