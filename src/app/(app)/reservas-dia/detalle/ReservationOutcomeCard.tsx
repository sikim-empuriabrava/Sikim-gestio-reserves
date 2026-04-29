'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const statusStyles: Record<string, string> = {
  confirmed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  completed: 'border-emerald-500/25 bg-emerald-900/30 text-emerald-100',
  draft: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  no_show: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  incident: 'border-red-500/30 bg-red-500/10 text-red-200',
  cancelled: 'border-stone-600/60 bg-stone-900/70 text-stone-300',
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

  const statusClass = statusStyles[status] ?? 'border-stone-600/70 bg-stone-900/70 text-stone-200';

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
    <div className="space-y-4 rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 p-5 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.95)] transition-colors hover:border-[#8b6a43]/55">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm tabular-nums text-[#c99a61]">{entryTime ? `${entryTime.slice(0, 5)}h` : '—'}</p>
          <h3 className="text-lg font-semibold text-[#f6f0e8]">{groupName}</h3>
          <p className="text-sm text-[#b9aea1]">{paxLabel}{roomName ? ` · ${roomName}` : ''}</p>
          <div className="flex flex-wrap gap-2 text-xs text-[#b9aea1]">
            {hasPrivateDiningRoom && <span className="rounded-full border border-[#4a3f32]/70 bg-[#24221f]/70 px-2 py-0.5">Sala privada</span>}
            {hasPrivateParty && <span className="rounded-full border border-[#4a3f32]/70 bg-[#24221f]/70 px-2 py-0.5">Fiesta privada</span>}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusClass}`}>
              {status}
            </span>
            <Link
              href={`/reservas/grupo/${groupEventId}${eventDate ? `?date=${eventDate}` : ''}`}
              className="text-xs font-semibold text-[#d6a76e] hover:text-[#f0c58b]"
            >
              Ver reserva
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-semibold text-[#d6a76e] hover:text-[#f0c58b]"
          >
            {expanded ? 'Ocultar detalles' : 'Ver detalles'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 text-sm text-[#d8cfc2] md:grid-cols-2">
            <div className="space-y-2">
              {menuText && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#9d9285]">Notas de servicio</p>
                  <div className="mt-1 rounded-xl border border-[#4a3f32]/60 bg-[#12110f]/75 px-3 py-2 text-sm whitespace-pre-line">{menuText}</div>
                </div>
              )}
              {secondCourseType && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#9d9285]">Segundo plato</p>
                  <div className="mt-1 rounded-xl border border-[#4a3f32]/60 bg-[#12110f]/75 px-3 py-2 text-sm whitespace-pre-line">{secondCourseType}</div>
                </div>
              )}
              {allergensAndDiets && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#9d9285]">Alergias y dietas</p>
                  <div className="mt-1 rounded-xl border border-[#4a3f32]/60 bg-[#12110f]/75 px-3 py-2 text-sm whitespace-pre-line">{allergensAndDiets}</div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {extras && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#9d9285]">Extras (notas cocina)</p>
                  <div className="mt-1 rounded-xl border border-[#4a3f32]/60 bg-[#12110f]/75 px-3 py-2 text-sm whitespace-pre-line">{extras}</div>
                </div>
              )}
              {setupNotes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#9d9285]">Montaje (notas sala)</p>
                  <div className="mt-1 rounded-xl border border-[#4a3f32]/60 bg-[#12110f]/75 px-3 py-2 text-sm whitespace-pre-line">{setupNotes}</div>
                </div>
              )}
              {invoiceData && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#9d9285]">Datos de factura</p>
                  <div className="mt-1 rounded-xl border border-[#4a3f32]/60 bg-[#12110f]/75 px-3 py-2 text-sm whitespace-pre-line">{invoiceData}</div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-[#3c342a]/70 pt-4">
            <div className="space-y-3 rounded-xl border border-[#4a3f32]/70 bg-[#12110f]/75 p-3 text-xs text-[#d8cfc2]">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <label className="font-semibold" htmlFor={`${groupEventId}-outcome`}>
                  Resultado del servicio
                </label>
                <select
                  id={`${groupEventId}-outcome`}
                  value={currentOutcome}
                  onChange={(e) => setCurrentOutcome(e.target.value)}
                  className="w-full max-w-xs rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3 py-2 text-sm text-[#f4ede3] focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15"
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
                    className="h-20 w-full rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3 py-2 text-sm text-[#f4ede3] placeholder:text-[#786f64] focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15"
                    placeholder="Observaciones del servicio"
                  />
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/15 disabled:opacity-60"
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
