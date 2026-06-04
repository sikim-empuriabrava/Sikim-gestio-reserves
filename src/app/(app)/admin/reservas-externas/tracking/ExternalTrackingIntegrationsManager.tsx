'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  TagIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import {
  OperationalEmptyState,
  OperationalPanel,
  OperationalPill,
  OperationalSectionHeader,
  operationalFieldClass,
  operationalLabelClass,
  operationalPrimaryButtonClass,
  operationalSecondaryButtonClass,
} from '@/components/operational/OperationalUI';

type Provider = 'meta_pixel' | 'google_tag' | 'google_ads_conversion' | 'google_tag_manager';
type ConsentCategory = 'analytics' | 'marketing';
type TriggerEvent = 'page_view' | 'reservation_request_submitted';

type ExternalTrackingIntegration = {
  id: string;
  provider: Provider;
  name: string;
  enabled: boolean;
  consentCategory: ConsentCategory;
  triggerEvent: TriggerEvent;
  metaPixelId: string | null;
  googleTagId: string | null;
  googleAdsConversionId: string | null;
  googleAdsConversionLabel: string | null;
  gtmContainerId: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type FormState = {
  provider: Provider;
  name: string;
  enabled: boolean;
  consentCategory: ConsentCategory;
  triggerEvent: TriggerEvent;
  metaPixelId: string;
  googleTagId: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  gtmContainerId: string;
  notes: string;
};

type Props = {
  initialRows: ExternalTrackingIntegration[];
  initialLoadError: string | null;
};

const PROVIDER_OPTIONS: Array<{ value: Provider; label: string }> = [
  { value: 'meta_pixel', label: 'Meta Pixel' },
  { value: 'google_tag', label: 'Google Tag' },
  { value: 'google_ads_conversion', label: 'Google Ads Conversion' },
  { value: 'google_tag_manager', label: 'Google Tag Manager' },
];

const CONSENT_OPTIONS: Array<{ value: ConsentCategory; label: string }> = [
  { value: 'analytics', label: 'Analitica' },
  { value: 'marketing', label: 'Marketing' },
];

const TRIGGER_OPTIONS: Array<{ value: TriggerEvent; label: string }> = [
  { value: 'page_view', label: 'Page view' },
  { value: 'reservation_request_submitted', label: 'Solicitud de reserva enviada' },
];

const emptyForm: FormState = {
  provider: 'meta_pixel',
  name: '',
  enabled: false,
  consentCategory: 'marketing',
  triggerEvent: 'reservation_request_submitted',
  metaPixelId: '',
  googleTagId: '',
  googleAdsConversionId: '',
  googleAdsConversionLabel: '',
  gtmContainerId: '',
  notes: '',
};

function providerLabel(provider: Provider) {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

function consentLabel(category: ConsentCategory) {
  return CONSENT_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

function triggerLabel(triggerEvent: TriggerEvent) {
  return TRIGGER_OPTIONS.find((option) => option.value === triggerEvent)?.label ?? triggerEvent;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin registro';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin registro';

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function formFromRow(row: ExternalTrackingIntegration): FormState {
  return {
    provider: row.provider,
    name: row.name,
    enabled: row.enabled,
    consentCategory: row.consentCategory,
    triggerEvent: row.triggerEvent,
    metaPixelId: row.metaPixelId ?? '',
    googleTagId: row.googleTagId ?? '',
    googleAdsConversionId: row.googleAdsConversionId ?? '',
    googleAdsConversionLabel: row.googleAdsConversionLabel ?? '',
    gtmContainerId: row.gtmContainerId ?? '',
    notes: row.notes ?? '',
  };
}

function sanitizeFormForProvider(form: FormState): FormState {
  const next = {
    ...form,
    consentCategory:
      form.provider === 'meta_pixel' || form.provider === 'google_ads_conversion'
        ? 'marketing'
        : form.consentCategory,
  };

  if (next.provider !== 'meta_pixel') next.metaPixelId = '';
  if (next.provider !== 'google_tag') next.googleTagId = '';
  if (next.provider !== 'google_ads_conversion') {
    next.googleAdsConversionId = '';
    next.googleAdsConversionLabel = '';
  }
  if (next.provider !== 'google_tag_manager') next.gtmContainerId = '';

  return next;
}

function buildPayload(form: FormState) {
  const sanitized = sanitizeFormForProvider(form);

  return {
    provider: sanitized.provider,
    name: sanitized.name,
    enabled: sanitized.enabled,
    consentCategory: sanitized.consentCategory,
    triggerEvent: sanitized.triggerEvent,
    metaPixelId: sanitized.metaPixelId || null,
    googleTagId: sanitized.googleTagId || null,
    googleAdsConversionId: sanitized.googleAdsConversionId || null,
    googleAdsConversionLabel: sanitized.googleAdsConversionLabel || null,
    gtmContainerId: sanitized.gtmContainerId || null,
    notes: sanitized.notes || null,
  };
}

function primaryId(row: ExternalTrackingIntegration) {
  if (row.provider === 'meta_pixel') return row.metaPixelId;
  if (row.provider === 'google_tag') return row.googleTagId;
  if (row.provider === 'google_ads_conversion') return row.googleAdsConversionId;
  return row.gtmContainerId;
}

export function ExternalTrackingIntegrationsManager({ initialRows, initialLoadError }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [message, setMessage] = useState<string | null>(null);

  const enabledCount = useMemo(() => rows.filter((row) => row.enabled).length, [rows]);
  const isFixedMarketing = form.provider === 'meta_pixel' || form.provider === 'google_ads_conversion';

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(initialLoadError);
    setMessage(null);
  };

  const updateForm = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => sanitizeFormForProvider({ ...current, [key]: value }));
    setError(null);
    setMessage(null);
  };

  const startEditing = (row: ExternalTrackingIntegration) => {
    setForm(formFromRow(row));
    setEditingId(row.id);
    setError(null);
    setMessage(null);
  };

  const upsertRow = (nextRow: ExternalTrackingIntegration) => {
    setRows((currentRows) => {
      const exists = currentRows.some((row) => row.id === nextRow.id);
      const nextRows = exists
        ? currentRows.map((row) => (row.id === nextRow.id ? nextRow : row))
        : [nextRow, ...currentRows];

      return [...nextRows].sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      });
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        editingId
          ? `/api/admin/external-tracking-integrations/${editingId}`
          : '/api/admin/external-tracking-integrations',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildPayload(form)),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        row?: ExternalTrackingIntegration;
      };

      if (!response.ok || !payload.row) {
        throw new Error(payload.error || 'No se pudo guardar la integracion.');
      }

      upsertRow(payload.row);
      setForm(emptyForm);
      setEditingId(null);
      setMessage(editingId ? 'Integracion actualizada.' : 'Integracion creada.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar la integracion.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRow = async (row: ExternalTrackingIntegration) => {
    setBusyRowId(row.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/external-tracking-integrations/${row.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildPayload({ ...formFromRow(row), enabled: !row.enabled })),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        row?: ExternalTrackingIntegration;
      };

      if (!response.ok || !payload.row) {
        throw new Error(payload.error || 'No se pudo cambiar el estado.');
      }

      upsertRow(payload.row);
      setMessage(payload.row.enabled ? 'Integracion activada.' : 'Integracion desactivada.');
      router.refresh();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusyRowId(null);
    }
  };

  const deleteRow = async (row: ExternalTrackingIntegration) => {
    const confirmed = window.confirm(`Eliminar "${row.name}"?`);
    if (!confirmed) return;

    setBusyRowId(row.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/external-tracking-integrations/${row.id}`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };

      if (!response.ok || !payload.id) {
        throw new Error(payload.error || 'No se pudo eliminar la integracion.');
      }

      setRows((currentRows) => currentRows.filter((currentRow) => currentRow.id !== payload.id));
      if (editingId === payload.id) {
        setForm(emptyForm);
        setEditingId(null);
      }
      setMessage('Integracion eliminada.');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la integracion.');
    } finally {
      setBusyRowId(null);
    }
  };

  return (
    <div className="space-y-6">
      <OperationalPanel className="p-5">
        <OperationalSectionHeader
          icon={ShieldCheckIcon}
          title="Alcance de esta configuracion"
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <OperationalPill tone="muted">{rows.length} integraciones</OperationalPill>
              <OperationalPill tone={enabledCount > 0 ? 'success' : 'muted'}>
                {enabledCount} activas
              </OperationalPill>
            </div>
          }
        >
          Esta pantalla solo guarda IDs estructurados para fases futuras. No carga Meta Pixel, Google Tag,
          Google Tag Manager, conversion tracking, cookies ni scripts externos en la web publica.
        </OperationalSectionHeader>
      </OperationalPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <OperationalPanel className="p-5">
          <OperationalSectionHeader
            icon={editingId ? PencilSquareIcon : PlusIcon}
            title={editingId ? 'Editar integracion' : 'Nueva integracion'}
            meta={<OperationalPill tone={form.enabled ? 'success' : 'muted'}>{form.enabled ? 'Activa' : 'Inactiva'}</OperationalPill>}
          >
            Guarda solo IDs y labels. Los campos cambian segun el proveedor seleccionado.
          </OperationalSectionHeader>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <label className={operationalLabelClass}>
              <span className="block font-semibold">Nombre interno</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                className={operationalFieldClass}
                placeholder="Ej. Meta Pixel reservas"
                maxLength={120}
                required
                disabled={saving}
              />
            </label>

            <label className={operationalLabelClass}>
              <span className="block font-semibold">Proveedor</span>
              <select
                value={form.provider}
                onChange={(event) => updateForm('provider', event.target.value as Provider)}
                className={operationalFieldClass}
                disabled={saving}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/75 px-4 py-3 text-sm text-[#efe8dc]">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => updateForm('enabled', event.target.checked)}
                className="h-4 w-4 accent-[#c9833f]"
                disabled={saving}
              />
              <span className="font-semibold">Activo</span>
            </label>

            {isFixedMarketing ? (
              <div className="rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/70 px-4 py-3 text-sm text-[#d8cfc2]">
                <span className="font-semibold">Categoria de consentimiento:</span> marketing
              </div>
            ) : (
              <label className={operationalLabelClass}>
                <span className="block font-semibold">Categoria de consentimiento</span>
                <select
                  value={form.consentCategory}
                  onChange={(event) => updateForm('consentCategory', event.target.value as ConsentCategory)}
                  className={operationalFieldClass}
                  disabled={saving}
                >
                  {CONSENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className={operationalLabelClass}>
              <span className="block font-semibold">Evento</span>
              <select
                value={form.triggerEvent}
                onChange={(event) => updateForm('triggerEvent', event.target.value as TriggerEvent)}
                className={operationalFieldClass}
                disabled={saving}
              >
                {TRIGGER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {form.provider === 'meta_pixel' ? (
              <label className={operationalLabelClass}>
                <span className="block font-semibold">Meta Pixel ID</span>
                <input
                  type="text"
                  value={form.metaPixelId}
                  onChange={(event) => updateForm('metaPixelId', event.target.value)}
                  className={operationalFieldClass}
                  placeholder="123456789012345"
                  maxLength={64}
                  required
                  disabled={saving}
                />
              </label>
            ) : null}

            {form.provider === 'google_tag' ? (
              <label className={operationalLabelClass}>
                <span className="block font-semibold">Google Tag ID</span>
                <input
                  type="text"
                  value={form.googleTagId}
                  onChange={(event) => updateForm('googleTagId', event.target.value)}
                  className={operationalFieldClass}
                  placeholder="G-XXXXXXXXXX o AW-XXXXXXXXXX"
                  maxLength={80}
                  required
                  disabled={saving}
                />
              </label>
            ) : null}

            {form.provider === 'google_ads_conversion' ? (
              <div className="space-y-4">
                <label className={operationalLabelClass}>
                  <span className="block font-semibold">Google Ads Conversion ID</span>
                  <input
                    type="text"
                    value={form.googleAdsConversionId}
                    onChange={(event) => updateForm('googleAdsConversionId', event.target.value)}
                    className={operationalFieldClass}
                    placeholder="AW-XXXXXXXXXX"
                    maxLength={80}
                    required
                    disabled={saving}
                  />
                </label>

                <label className={operationalLabelClass}>
                  <span className="block font-semibold">Google Ads Conversion Label</span>
                  <input
                    type="text"
                    value={form.googleAdsConversionLabel}
                    onChange={(event) => updateForm('googleAdsConversionLabel', event.target.value)}
                    className={operationalFieldClass}
                    placeholder="Label de conversion"
                    maxLength={128}
                    required
                    disabled={saving}
                  />
                </label>
              </div>
            ) : null}

            {form.provider === 'google_tag_manager' ? (
              <div className="space-y-4">
                <label className={operationalLabelClass}>
                  <span className="block font-semibold">GTM Container ID</span>
                  <input
                    type="text"
                    value={form.gtmContainerId}
                    onChange={(event) => updateForm('gtmContainerId', event.target.value)}
                    className={operationalFieldClass}
                    placeholder="GTM-XXXXXXX"
                    maxLength={80}
                    required
                    disabled={saving}
                  />
                </label>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  GTM puede cargar varios tags. Las futuras cargas deberan respetar el consentimiento del
                  usuario.
                </div>
              </div>
            ) : null}

            <label className={operationalLabelClass}>
              <span className="block font-semibold">Notas</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
                className={`${operationalFieldClass} min-h-28 resize-y`}
                placeholder="Uso previsto, campana o contexto interno"
                maxLength={1000}
                disabled={saving}
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="submit" disabled={saving || Boolean(initialLoadError)} className={operationalPrimaryButtonClass}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear integracion'}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} disabled={saving} className={operationalSecondaryButtonClass}>
                  Cancelar edicion
                </button>
              ) : null}
            </div>

            {error ? <p className="text-sm leading-6 text-amber-200">{error}</p> : null}
            {message ? <p className="text-sm leading-6 text-emerald-300">{message}</p> : null}
          </form>
        </OperationalPanel>

        <OperationalPanel className="p-5">
          <OperationalSectionHeader icon={TagIcon} title="Integraciones guardadas">
            Lista interna de configuraciones. Aunque una integracion este activa, esta fase no carga pixeles ni
            tags en el motor publico.
          </OperationalSectionHeader>

          {rows.length === 0 ? (
            <OperationalEmptyState
              icon={TagIcon}
              title="Sin integraciones"
              description="Aun no hay IDs de tracking guardados para reservas externas."
              className="mt-5 min-h-[20rem]"
            />
          ) : (
            <div className="mt-5 overflow-x-auto rounded-xl border border-[#4a3f32]/80">
              <table className="min-w-[54rem] w-full text-left text-sm">
                <thead className="bg-[#12110f]/80 text-xs uppercase tracking-[0.14em] text-[#a99d90]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Integracion</th>
                    <th className="px-4 py-3 font-semibold">ID principal</th>
                    <th className="px-4 py-3 font-semibold">Consentimiento</th>
                    <th className="px-4 py-3 font-semibold">Evento</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Actualizada</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3c342a]/80">
                  {rows.map((row) => {
                    const isBusy = busyRowId === row.id;

                    return (
                      <tr key={row.id} className="bg-[#151412]/45 align-top text-[#d8cfc2]">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-[#f6f0e8]">{row.name}</p>
                          <p className="mt-1 text-xs text-[#a99d90]">{providerLabel(row.provider)}</p>
                          {row.provider === 'google_tag_manager' ? (
                            <p className="mt-2 max-w-xs text-xs leading-5 text-amber-200">
                              GTM puede cargar multiples tags en una fase futura.
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-[#efe8dc]">{primaryId(row) ?? 'Sin ID'}</td>
                        <td className="px-4 py-4">
                          <OperationalPill tone={row.consentCategory === 'marketing' ? 'accent' : 'info'}>
                            {consentLabel(row.consentCategory)}
                          </OperationalPill>
                        </td>
                        <td className="px-4 py-4 text-[#d8cfc2]">{triggerLabel(row.triggerEvent)}</td>
                        <td className="px-4 py-4">
                          <OperationalPill tone={row.enabled ? 'success' : 'muted'}>
                            {row.enabled ? 'Activa' : 'Inactiva'}
                          </OperationalPill>
                        </td>
                        <td className="px-4 py-4 text-xs text-[#a99d90]">{formatDateTime(row.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => toggleRow(row)}
                              disabled={isBusy || saving}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 text-[#efe8dc] transition hover:border-[#8b6a43]/75 hover:text-[#ffe2b6] focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/30 disabled:cursor-not-allowed disabled:opacity-55"
                              aria-label={row.enabled ? 'Desactivar integracion' : 'Activar integracion'}
                              title={row.enabled ? 'Desactivar' : 'Activar'}
                            >
                              {row.enabled ? (
                                <XCircleIcon className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditing(row)}
                              disabled={isBusy || saving}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 text-[#efe8dc] transition hover:border-[#8b6a43]/75 hover:text-[#ffe2b6] focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/30 disabled:cursor-not-allowed disabled:opacity-55"
                              aria-label="Editar integracion"
                              title="Editar"
                            >
                              <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRow(row)}
                              disabled={isBusy || saving}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/15 focus:outline-none focus:ring-2 focus:ring-rose-400/30 disabled:cursor-not-allowed disabled:opacity-55"
                              aria-label="Eliminar integracion"
                              title="Eliminar"
                            >
                              <TrashIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </OperationalPanel>
      </div>
    </div>
  );
}
