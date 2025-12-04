'use client';

import { useEffect, useState } from 'react';

export function DayStatusPanel({ eventDate }: { eventDate: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [dayNotes, setDayNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchDayStatus = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/day-status?date=${eventDate}`);
        if (!res.ok) {
          throw new Error('No se pudo obtener el estado del día');
        }
        const data = await res.json();
        setIsValidated(Boolean(data.is_validated));
        setDayNotes(data.day_notes ?? '');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Error inesperado');
      } finally {
        setLoading(false);
      }
    };

    fetchDayStatus();
  }, [eventDate]);

  const formatDate = (dateString: string) => {
    const formatter = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatter.format(new Date(dateString));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/day-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventDate,
          day_notes: dayNotes,
        }),
      });

      if (!res.ok) {
        throw new Error('No se pudo guardar el estado del día');
      }

      const data = await res.json();
      setIsValidated(Boolean(data.is_validated));
      setDayNotes(data.day_notes ?? '');
      setSuccessMessage('Día validado correctamente');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">Estado del día</p>
          <p className="text-sm text-slate-400">{formatDate(eventDate)}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            isValidated
              ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/50'
              : 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40'
          }`}
        >
          {isValidated ? 'Validado' : 'No validado'}
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="day-notes">
          Notas generales
        </label>
        <textarea
          id="day-notes"
          value={dayNotes}
          onChange={(e) => setDayNotes(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          rows={3}
          placeholder="Notas generales del día (cocina, mantenimiento, dirección...)"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-400">
          {loading ? 'Cargando estado...' : isValidated ? 'El día está validado.' : 'El día está pendiente de validar.'}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar notas y validar día'}
        </button>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-300">{errorMessage}</p>
      )}

      {successMessage && (
        <p className="text-sm text-emerald-300">{successMessage}</p>
      )}
    </div>
  );
}
