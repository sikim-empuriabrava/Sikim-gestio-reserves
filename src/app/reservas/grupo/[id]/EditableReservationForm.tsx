'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type EditableReservation = {
  id: string;
  name: string;
  event_date: string;
  entry_time: string;
  adults: number | null;
  children: number | null;
  total_pax: number | null;
  has_private_dining_room: boolean;
  has_private_party: boolean;
  second_course_type: string | null;
  menu_text: string | null;
  allergens_and_diets: string | null;
  extras: string | null;
  setup_notes: string | null;
  invoice_data: string | null;
  deposit_amount: number | null;
  deposit_status: string | null;
  status: string;
};

type Props = {
  reservation: EditableReservation;
  backDate?: string | null;
};

export function EditableReservationForm({ reservation, backDate }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<EditableReservation>(reservation);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (key: keyof EditableReservation, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value } as EditableReservation));
  };

  const handleSubmit = async () => {
    setMessage(null);
    setError(null);
    setCalendarWarning(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/group-events/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'No se pudo guardar la reserva');
        }

        try {
          const resCalendar = await fetch('/api/calendar-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ groupEventId: form.id }),
          });

          if (!resCalendar.ok) {
            console.error('[Editar reserva] Error sincronizando con Google Calendar', resCalendar.statusText);
            setCalendarWarning(
              'La reserva se ha guardado, pero ha habido un problema al sincronizar con Google Calendar. Revisa el calendario o inténtalo más tarde.',
            );
          }
        } catch (e) {
          console.error('[Editar reserva] Error sincronizando con Google Calendar', e);
          setCalendarWarning(
            'La reserva se ha guardado, pero ha habido un problema al sincronizar con Google Calendar. Revisa el calendario o inténtalo más tarde.',
          );
        }

        setMessage('Cambios guardados');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error inesperado');
      }
    });
  };

  const parseNumber = (value: string) => {
    if (value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleBack = () => {
    if (backDate) {
      router.push(`/reservas?view=day&date=${backDate}`);
    } else {
      router.back();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-wide text-primary-200">Detalle de reserva</p>
          <h1 className="text-2xl font-semibold text-slate-100">{form.name}</h1>
          <p className="text-slate-400">
            {form.event_date} · {form.entry_time ? `${form.entry_time.slice(0, 5)}h` : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
        >
          ← Volver al día
        </button>
      </div>

      <div className="space-y-4">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Datos generales</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Fecha</label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => handleChange('event_date', e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Hora</label>
                <input
                  type="time"
                  value={form.entry_time}
                  onChange={(e) => handleChange('entry_time', e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Adultos</label>
              <input
                type="number"
                value={form.adults ?? ''}
                onChange={(e) => handleChange('adults', parseNumber(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Niños</label>
              <input
                type="number"
                value={form.children ?? ''}
                onChange={(e) => handleChange('children', parseNumber(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Total pax (calculado)
              </label>
              <input
                type="number"
                value={form.total_pax ?? ''}
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-100">
              <input
                type="checkbox"
                checked={form.has_private_dining_room}
                onChange={(e) => handleChange('has_private_dining_room', e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500"
              />
              Sala privada
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-100">
              <input
                type="checkbox"
                checked={form.has_private_party}
                onChange={(e) => handleChange('has_private_party', e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500"
              />
              Fiesta privada
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Menú y cocina</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Menú</label>
              <input
                type="text"
                value={form.menu_text ?? ''}
                onChange={(e) => handleChange('menu_text', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Segundo plato</label>
              <input
                type="text"
                value={form.second_course_type ?? ''}
                onChange={(e) => handleChange('second_course_type', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Alergias y dietas</label>
              <textarea
                value={form.allergens_and_diets ?? ''}
                onChange={(e) => handleChange('allergens_and_diets', e.target.value)}
                className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Extras (cocina)</label>
              <textarea
                value={form.extras ?? ''}
                onChange={(e) => handleChange('extras', e.target.value)}
                className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Montaje y sala</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Montaje / sala</label>
            <textarea
              value={form.setup_notes ?? ''}
              onChange={(e) => handleChange('setup_notes', e.target.value)}
              className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Facturación y depósito</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Datos de factura</label>
              <textarea
                value={form.invoice_data ?? ''}
                onChange={(e) => handleChange('invoice_data', e.target.value)}
                className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Depósito (€)</label>
                <input
                  type="number"
                  value={form.deposit_amount ?? ''}
                  onChange={(e) => handleChange('deposit_amount', parseNumber(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Estado depósito</label>
                <input
                  type="text"
                  value={form.deposit_status ?? ''}
                  onChange={(e) => handleChange('deposit_status', e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Estado</label>
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                <option value="draft">Borrador</option>
                <option value="confirmed">Confirmado</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {message && <span className="text-sm text-emerald-300">{message}</span>}
          {calendarWarning && <span className="text-sm text-amber-400">{calendarWarning}</span>}
          {error && <span className="text-sm text-red-300">{error}</span>}
        </div>
      </div>
    </div>
  );
}
