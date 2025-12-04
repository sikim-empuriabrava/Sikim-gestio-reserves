'use client';

import { useState } from 'react';

const statusStyles: Record<string, string> = {
  confirmed: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40',
  completed: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/40',
  cancelled: 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40',
};

type ReservationOutcomeCardProps = {
  groupEventId: string;
  groupName: string;
  entryTime: string | null;
  totalPax: number | null;
  roomName: string | null;
  status: string;
  hasPrivateDiningRoom?: boolean | null;
  hasPrivateParty?: boolean | null;
  serviceOutcome?: string | null;
  serviceOutcomeNotes?: string | null;
};

export function ReservationOutcomeCard({
  groupEventId,
  groupName,
  entryTime,
  totalPax,
  roomName,
  status,
  hasPrivateDiningRoom,
  hasPrivateParty,
  serviceOutcome,
  serviceOutcomeNotes,
}: ReservationOutcomeCardProps) {
  const [currentOutcome, setCurrentOutcome] = useState(serviceOutcome ?? 'normal');
  const [notes, setNotes] = useState(serviceOutcomeNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/group-events/service-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupEventId,
          serviceOutcome: currentOutcome,
          serviceOutcomeNotes: notes,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo guardar la información');
      }

      setMessage('Guardado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const statusClass = statusStyles[status] ?? 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-400">{entryTime ? `${entryTime.slice(0, 5)}h` : '—'}</p>
          <h3 className="text-lg font-semibold text-slate-100">{groupName}</h3>
          <p className="text-sm text-slate-300">{totalPax ?? '—'} pax · {roomName ?? '—'}</p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            {hasPrivateDiningRoom && <span className="rounded-full bg-slate-800 px-2 py-0.5">Sala privada</span>}
            {hasPrivateParty && <span className="rounded-full bg-slate-800 px-2 py-0.5">Fiesta privada</span>}
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
          {status}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[200px,1fr]">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor={`${groupEventId}-outcome`}>
            Resultado del servicio
          </label>
          <select
            id={`${groupEventId}-outcome`}
            value={currentOutcome}
            onChange={(e) => setCurrentOutcome(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          >
            <option value="normal">Normal</option>
            <option value="note">Nota</option>
            <option value="incident">Incidente</option>
            <option value="no_show">No show</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor={`${groupEventId}-notes`}>
            Notas de servicio
          </label>
          <textarea
            id={`${groupEventId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            placeholder="Observaciones del servicio"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {message && <span className="text-sm text-emerald-300">{message}</span>}
        {error && <span className="text-sm text-red-300">{error}</span>}
      </div>
    </div>
  );
}
