'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const statusStyles: Record<string, string> = {
  confirmed: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/50',
  completed: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/50',
  draft: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/50',
  no_show: 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/50',
  incident: 'bg-red-500/25 text-red-100 ring-1 ring-red-400/50',
  cancelled: 'bg-slate-800/70 text-slate-200 ring-1 ring-slate-600/50',
};

type ReservationOutcomeCardProps = {
  groupEventId: string;
  groupName: string;
  entryTime: string | null;
  totalPax: number | null;
  adults?: number | null;
  childrenCount?: number | null;
  roomName: string | null;
  status: string;
  hasPrivateDiningRoom?: boolean | null;
  hasPrivateParty?: boolean | null;
  serviceOutcome?: string | null;
  serviceOutcomeNotes?: string | null;
  eventDate?: string;
  secondCourseType?: string | null;
  menuText?: string | null;
  allergensAndDiets?: string | null;
  extras?: string | null;
  setupNotes?: string | null;
  invoiceData?: string | null;
};

export function ReservationOutcomeCard({
  groupEventId,
  groupName,
  entryTime,
  totalPax,
  adults,
  childrenCount,
  roomName,
  status,
  hasPrivateDiningRoom,
  hasPrivateParty,
  serviceOutcome,
  serviceOutcomeNotes,
  eventDate,
  secondCourseType,
  menuText,
  allergensAndDiets,
  extras,
  setupNotes,
  invoiceData,
}: ReservationOutcomeCardProps) {
  const [currentOutcome, setCurrentOutcome] = useState(serviceOutcome ?? 'normal');
  const [notes, setNotes] = useState(serviceOutcomeNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/group-events/service-outcome', {
        method: 'POST',
        cache: 'no-store',
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

  const statusClass = statusStyles[status] ?? 'bg-slate-800/80 text-slate-100 ring-1 ring-slate-700/70';

  const paxValue = useMemo(() => {
    if (typeof totalPax === 'number') return totalPax;
    if (typeof adults === 'number' || typeof childrenCount === 'number') {
      return (adults ?? 0) + (childrenCount ?? 0);
    }
    return null;
  }, [adults, childrenCount, totalPax]);

  const paxLabel = paxValue !== null ? `${paxValue} pax` : '— pax';

  const showServiceNotes = currentOutcome !== 'normal';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-400">{entryTime ? `${entryTime.slice(0, 5)}h` : '—'}</p>
          <h3 className="text-lg font-semibold text-slate-100">{groupName}</h3>
          <p className="text-sm text-slate-300">{paxLabel}{roomName ? ` · ${roomName}` : ''}</p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            {hasPrivateDiningRoom && <span className="rounded-full bg-slate-800 px-2 py-0.5">Sala privada</span>}
            {hasPrivateParty && <span className="rounded-full bg-slate-800 px-2 py-0.5">Fiesta privada</span>}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusClass}`}>
              {status}
            </span>
            <Link
              href={`/reservas/grupo/${groupEventId}${eventDate ? `?date=${eventDate}` : ''}`}
              className="text-xs font-semibold text-emerald-300 hover:underline"
            >
              Ver reserva
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-semibold text-emerald-200 hover:text-emerald-100"
          >
            {expanded ? 'Ocultar detalles' : 'Ver detalles'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
            <div className="space-y-2">
              {menuText && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Notas de servicio</p>
                  <div className="mt-1 rounded-lg bg-slate-950/50 px-3 py-2 text-sm whitespace-pre-line">{menuText}</div>
                </div>
              )}
              {secondCourseType && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Segundo plato</p>
                  <div className="mt-1 rounded-lg bg-slate-950/50 px-3 py-2 text-sm whitespace-pre-line">{secondCourseType}</div>
                </div>
              )}
              {allergensAndDiets && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Alergias y dietas</p>
                  <div className="mt-1 rounded-lg bg-slate-950/50 px-3 py-2 text-sm whitespace-pre-line">{allergensAndDiets}</div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {extras && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Extras (notas cocina)</p>
                  <div className="mt-1 rounded-lg bg-slate-950/50 px-3 py-2 text-sm whitespace-pre-line">{extras}</div>
                </div>
              )}
              {setupNotes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Montaje (notas sala)</p>
                  <div className="mt-1 rounded-lg bg-slate-950/50 px-3 py-2 text-sm whitespace-pre-line">{setupNotes}</div>
                </div>
              )}
              {invoiceData && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Datos de factura</p>
                  <div className="mt-1 rounded-lg bg-slate-950/50 px-3 py-2 text-sm whitespace-pre-line">{invoiceData}</div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <label className="font-semibold" htmlFor={`${groupEventId}-outcome`}>
                  Resultado del servicio
                </label>
                <select
                  id={`${groupEventId}-outcome`}
                  value={currentOutcome}
                  onChange={(e) => setCurrentOutcome(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                >
                  <option value="normal">Normal</option>
                  <option value="note">Anotación</option>
                  <option value="incident">Incidente</option>
                  <option value="no_show">No show</option>
                </select>
              </div>
              {showServiceNotes && (
                <div className="space-y-1">
                  <label className="font-semibold" htmlFor={`${groupEventId}-notes`}>
                    Notas de servicio
                  </label>
                  <textarea
                    id={`${groupEventId}-notes`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-20 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                    placeholder="Observaciones del servicio"
                  />
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {message && <span className="text-emerald-300">{message}</span>}
                {error && <span className="text-red-300">{error}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
