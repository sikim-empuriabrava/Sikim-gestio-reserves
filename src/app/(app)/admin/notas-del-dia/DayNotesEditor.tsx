'use client';

import { useEffect, useMemo, useState } from 'react';

type DayStatusRow = {
  event_date: string;
  notes_kitchen?: string | null;
  notes_maintenance?: string | null;
  notes_general?: string | null;
  day_notes?: string | null;
};

type FetchState = 'idle' | 'loading' | 'error' | 'success';

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function DayNotesEditor() {
  const today = useMemo(() => toISODate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [notesKitchen, setNotesKitchen] = useState('');
  const [notesMaintenance, setNotesMaintenance] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchNotes = async () => {
      setFetchState('loading');
      setStatusMessage(null);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/day-status?date=${selectedDate}`, {
          cache: 'no-store',
        });

        if (res.status === 401) {
          throw new Error('Necesitas iniciar sesión para ver las notas');
        }

        if (!res.ok) {
          throw new Error('No se pudieron cargar las notas del día');
        }

        const data: DayStatusRow | null = await res.json();
        setNotesKitchen(data?.notes_kitchen ?? data?.day_notes ?? '');
        setNotesMaintenance(data?.notes_maintenance ?? '');
        setFetchState('success');
      } catch (err) {
        setFetchState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Error inesperado');
      }
    };

    fetchNotes();
  }, [selectedDate]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/day-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          date: selectedDate,
          notes_kitchen: notesKitchen,
          notes_maintenance: notesMaintenance,
          action: 'save',
        }),
      });

      if (res.status === 401) {
        throw new Error('Sesión caducada. Inicia sesión para guardar.');
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudieron guardar las notas');
      }

      setStatusMessage('Guardado ✅');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado al guardar');
    } finally {
      setSaving(false);
    }
  };

  const disabled = fetchState === 'loading' || saving;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-200">Selecciona fecha</p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-56 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          />
        </div>
        {fetchState === 'loading' && <p className="text-sm text-slate-400">Cargando notas…</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="notes-kitchen">
            Notas para cocina
          </label>
          <textarea
            id="notes-kitchen"
            value={notesKitchen}
            onChange={(e) => setNotesKitchen(e.target.value)}
            className="h-32 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            placeholder="Indicaciones diarias para cocina"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="notes-maintenance">
            Notas para mantenimiento
          </label>
          <textarea
            id="notes-maintenance"
            value={notesMaintenance}
            onChange={(e) => setNotesMaintenance(e.target.value)}
            className="h-32 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            placeholder="Recordatorios o incidencias de mantenimiento"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-400">
          {fetchState === 'error' && errorMessage}
          {fetchState !== 'error' && 'Las notas se guardan por día y están disponibles en Cocina y Mantenimiento.'}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled}
          className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {statusMessage && <p className="text-sm text-emerald-300">{statusMessage}</p>}
      {errorMessage && fetchState !== 'error' && <p className="text-sm text-red-300">{errorMessage}</p>}
    </div>
  );
}
