'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cog6ToothIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import {
  OperationalPanel,
  OperationalPill,
  OperationalSectionHeader,
  operationalFieldClass,
  operationalLabelClass,
  operationalPrimaryButtonClass,
} from '@/components/operational/OperationalUI';

type Summary = {
  isEnabled: boolean;
  currentType: 'none' | 'cheffing_card' | 'cheffing_menu';
  currentTypeLabel: 'Sin asignacion' | 'Carta' | 'Menu';
  currentName: string | null;
  currentCardId: string | null;
  currentMenuId: string | null;
  updatedAt: string | null;
};

type CardOption = {
  id: string;
  name: string;
};

type MenuOption = {
  id: string;
  name: string;
  price_per_person: number | null;
};

type Props = {
  initialSummary: Summary;
  initialCards: CardOption[];
  initialMenus: MenuOption[];
  initialLoadError: string | null;
};

function buildInitialMode(summary: Summary) {
  return summary.isEnabled ? summary.currentType : 'none';
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin registro';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Sin registro';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function formatPrice(value: number | null) {
  if (value === null) return null;

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function ExternalReservationSettingsManager({
  initialSummary,
  initialCards,
  initialMenus,
  initialLoadError,
}: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [mode, setMode] = useState<'none' | 'cheffing_card' | 'cheffing_menu'>(buildInitialMode(initialSummary));
  const [selectedCardId, setSelectedCardId] = useState(initialSummary.currentCardId ?? initialCards[0]?.id ?? '');
  const [selectedMenuId, setSelectedMenuId] = useState(initialSummary.currentMenuId ?? initialMenus[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isEnabled = mode !== 'none';
  const statusTone = summary.isEnabled ? 'success' : 'muted';

  const availabilitySummary = useMemo(
    () => ({
      cards: initialCards.length,
      menus: initialMenus.length,
    }),
    [initialCards.length, initialMenus.length],
  );

  const handleModeChange = (nextMode: 'none' | 'cheffing_card' | 'cheffing_menu') => {
    setMode(nextMode);
    setError(null);
    setMessage(null);

    if (nextMode === 'cheffing_card' && !selectedCardId && initialCards[0]) {
      setSelectedCardId(initialCards[0].id);
    }

    if (nextMode === 'cheffing_menu' && !selectedMenuId && initialMenus[0]) {
      setSelectedMenuId(initialMenus[0].id);
    }
  };

  const handleAutoAssignToggle = (checked: boolean) => {
    if (!checked) {
      handleModeChange('none');
      return;
    }

    if (mode !== 'none') {
      setMessage(null);
      return;
    }

    if (initialCards[0]) {
      handleModeChange('cheffing_card');
      return;
    }

    if (initialMenus[0]) {
      handleModeChange('cheffing_menu');
      return;
    }

    setError('No hay cartas o menus activos disponibles para activar la asignacion automatica.');
    setMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === 'cheffing_card' && !selectedCardId) {
      setError(
        initialCards.length === 0
          ? 'No hay cartas activas disponibles.'
          : 'Selecciona una carta activa antes de guardar.',
      );
      return;
    }

    if (mode === 'cheffing_menu' && !selectedMenuId) {
      setError(
        initialMenus.length === 0
          ? 'No hay menus activos disponibles.'
          : 'Selecciona un menu activo antes de guardar.',
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/admin/external-reservation-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          cheffingCardId: mode === 'cheffing_card' ? selectedCardId : null,
          cheffingMenuId: mode === 'cheffing_menu' ? selectedMenuId : null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        settings?: Summary;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || 'No se pudo guardar la configuracion');
      }

      setSummary(payload.settings);
      setMode(buildInitialMode(payload.settings));
      setSelectedCardId(payload.settings.currentCardId ?? selectedCardId);
      setSelectedMenuId(payload.settings.currentMenuId ?? selectedMenuId);
      setMessage('Configuracion guardada.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar la configuracion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {initialLoadError ? (
        <div className="rounded-2xl border border-amber-900/60 bg-amber-950/40 p-4 text-sm text-amber-100">
          {initialLoadError}
        </div>
      ) : null}

      <OperationalPanel className="p-5">
        <OperationalSectionHeader
          icon={GlobeAltIcon}
          title="Estado actual"
          meta={<OperationalPill tone={statusTone}>{summary.isEnabled ? 'Activo' : 'Desactivado'}</OperationalPill>}
        >
          Consulta de un vistazo si las solicitudes externas reciben una oferta automatica.
        </OperationalSectionHeader>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#4a3f32]/70 bg-[#12110f]/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a99d90]">Estado</p>
            <p className="mt-2 text-lg font-semibold text-[#f6f0e8]">
              {summary.isEnabled ? 'Asignacion activa' : 'Asignacion desactivada'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#4a3f32]/70 bg-[#12110f]/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a99d90]">Tipo actual</p>
            <p className="mt-2 text-lg font-semibold text-[#f6f0e8]">{summary.currentTypeLabel}</p>
          </div>

          <div className="rounded-2xl border border-[#4a3f32]/70 bg-[#12110f]/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a99d90]">Nombre actual</p>
            <p className="mt-2 text-lg font-semibold text-[#f6f0e8]">
              {summary.currentName ?? 'Sin oferta asignada'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#4a3f32]/70 bg-[#12110f]/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a99d90]">Ultima actualizacion</p>
            <p className="mt-2 text-lg font-semibold text-[#f6f0e8]">{formatDateTime(summary.updatedAt)}</p>
          </div>
        </div>
      </OperationalPanel>

      <OperationalPanel className="p-5">
        <OperationalSectionHeader
          icon={Cog6ToothIcon}
          title="Configuracion"
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <OperationalPill tone="muted">{availabilitySummary.cards} cartas activas</OperationalPill>
              <OperationalPill tone="muted">{availabilitySummary.menus} menus activos</OperationalPill>
            </div>
          }
        >
          Configura la carta o menu asignado automaticamente a las solicitudes del motor publico.
        </OperationalSectionHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[#4a3f32]/80 bg-[#12110f]/75 px-4 py-3 text-sm text-[#efe8dc]">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(event) => handleAutoAssignToggle(event.target.checked)}
              className="h-4 w-4 accent-[#c9833f]"
              disabled={saving}
            />
            <span className="font-semibold">
              Asignar automaticamente una carta o menu a las reservas externas
            </span>
          </label>

          <label className={operationalLabelClass}>
            <span className="block font-semibold">Tipo de asignacion</span>
            <select
              value={mode}
              onChange={(event) =>
                handleModeChange(event.target.value as 'none' | 'cheffing_card' | 'cheffing_menu')
              }
              className={operationalFieldClass}
              disabled={saving}
            >
              <option value="none">Sin asignacion automatica</option>
              <option value="cheffing_card">Carta</option>
              <option value="cheffing_menu">Menu</option>
            </select>
          </label>

          {mode === 'cheffing_card' ? (
            <label className={operationalLabelClass}>
              <span className="block font-semibold">Carta activa</span>
              <select
                value={selectedCardId}
                onChange={(event) => {
                  setSelectedCardId(event.target.value);
                  setError(null);
                  setMessage(null);
                }}
                className={operationalFieldClass}
                disabled={saving || initialCards.length === 0}
              >
                <option value="">{initialCards.length === 0 ? 'No hay cartas activas disponibles.' : 'Selecciona una carta'}</option>
                {initialCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
              {initialCards.length === 0 ? (
                <p className="text-sm text-amber-200">No hay cartas activas disponibles.</p>
              ) : null}
            </label>
          ) : null}

          {mode === 'cheffing_menu' ? (
            <label className={operationalLabelClass}>
              <span className="block font-semibold">Menu activo</span>
              <select
                value={selectedMenuId}
                onChange={(event) => {
                  setSelectedMenuId(event.target.value);
                  setError(null);
                  setMessage(null);
                }}
                className={operationalFieldClass}
                disabled={saving || initialMenus.length === 0}
              >
                <option value="">{initialMenus.length === 0 ? 'No hay menus activos disponibles.' : 'Selecciona un menu'}</option>
                {initialMenus.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name}
                    {menu.price_per_person !== null ? ` - ${formatPrice(menu.price_per_person)}/pax` : ''}
                  </option>
                ))}
              </select>
              {initialMenus.length === 0 ? (
                <p className="text-sm text-amber-200">No hay menus activos disponibles.</p>
              ) : null}
            </label>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="submit"
              disabled={saving || Boolean(initialLoadError)}
              className={`${operationalPrimaryButtonClass} min-h-11 sm:min-h-0`}
            >
              {saving ? 'Guardando...' : 'Guardar configuracion'}
            </button>
            {error ? <span className="text-sm text-amber-200">{error}</span> : null}
            {message ? <span className="text-sm text-emerald-300">{message}</span> : null}
          </div>
        </form>
      </OperationalPanel>
    </div>
  );
}
