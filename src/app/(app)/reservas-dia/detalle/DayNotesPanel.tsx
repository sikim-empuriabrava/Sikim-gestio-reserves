'use client';

import { useState } from 'react';

type DayNotesPanelProps = {
  eventDate: string;
  initialNotesGeneral: string;
  initialNotesKitchen: string;
  initialNotesMaintenance: string;
  initialValidated: boolean;
  initialNeedsRevalidation: boolean;
  initialValidatedBy?: string | null;
  initialValidatedAt?: string | null;
};

export function DayNotesPanel({
  eventDate,
  initialNotesGeneral,
  initialNotesKitchen,
  initialNotesMaintenance,
  initialValidated,
  initialNeedsRevalidation,
  initialValidatedBy,
  initialValidatedAt,
}: DayNotesPanelProps) {
  const [notesGeneral, setNotesGeneral] = useState(initialNotesGeneral ?? '');
  const [notesKitchen, setNotesKitchen] = useState(initialNotesKitchen ?? '');
  const [notesMaintenance, setNotesMaintenance] = useState(initialNotesMaintenance ?? '');
  const [validated, setValidated] = useState(Boolean(initialValidated));
  const [needsRevalidation, setNeedsRevalidation] = useState(Boolean(initialNeedsRevalidation));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validatedInfo, setValidatedInfo] = useState<{ by?: string | null; at?: string | null } | null>({
    by: initialValidatedBy,
    at: initialValidatedAt,
  });

  const formatDateTime = (value?: string | null) => {
    if (!value) return null;
    try {
      const formatter = new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      return formatter.format(new Date(value));
    } catch {
      return value;
    }
  };

  const handleAction = async (action: 'save' | 'validate') => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/day-status', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: eventDate,
          notes_general: notesGeneral,
          notes_kitchen: notesKitchen,
          notes_maintenance: notesMaintenance,
          action,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo guardar el estado del día');
      }

      const data = await res.json();
      setValidated(Boolean(data?.validated ?? data?.is_validated));
      setNeedsRevalidation(Boolean(data?.needs_revalidation));
      setValidatedInfo({ by: data?.last_validated_by, at: data?.last_validated_at });
      setMessage(action === 'validate' ? 'Día validado correctamente' : 'Notas guardadas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const badgeColor = validated
    ? needsRevalidation
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : 'border-stone-600/60 bg-stone-900/70 text-stone-300';

  const badgeLabel = validated
    ? needsRevalidation
      ? 'Cambios desde validación'
      : 'Validado'
    : 'No validado';

  return (
    <div className="space-y-5 rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 p-5 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.95)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#f6f0e8]">Notas del día</h2>
          {validatedInfo?.at && (
            <p className="text-xs text-[#9d9285]">
              Validado por {validatedInfo.by ?? '—'} el {formatDateTime(validatedInfo.at)}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#cfc4b5]" htmlFor="notes-general">
            Notas generales
          </label>
          <textarea
            id="notes-general"
            value={notesGeneral}
            onChange={(e) => setNotesGeneral(e.target.value)}
            className="h-32 w-full rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3 py-2 text-sm text-[#f4ede3] placeholder:text-[#786f64] focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15"
            placeholder="Notas generales del día"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#cfc4b5]" htmlFor="notes-kitchen">
            Notas cocina
          </label>
          <textarea
            id="notes-kitchen"
            value={notesKitchen}
            onChange={(e) => setNotesKitchen(e.target.value)}
            className="h-32 w-full rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3 py-2 text-sm text-[#f4ede3] placeholder:text-[#786f64] focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15"
            placeholder="Indicaciones para cocina"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#cfc4b5]" htmlFor="notes-maintenance">
            Notas mantenimiento
          </label>
          <textarea
            id="notes-maintenance"
            value={notesMaintenance}
            onChange={(e) => setNotesMaintenance(e.target.value)}
            className="h-32 w-full rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3 py-2 text-sm text-[#f4ede3] placeholder:text-[#786f64] focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15"
            placeholder="Incidencias o recordatorios de mantenimiento"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => handleAction('save')}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-4 py-2 text-sm font-semibold text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar notas'}
        </button>
        <button
          type="button"
          onClick={() => handleAction('validate')}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/15 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Validar día'}
        </button>
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
