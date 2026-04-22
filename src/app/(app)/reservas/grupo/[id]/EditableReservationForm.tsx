'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ReservationOfferingKind = 'cheffing_menu' | 'cheffing_card';
type DonenessPoint = 'crudo' | 'poco' | 'al_punto' | 'hecho' | 'muy_hecho';

type ReservationOfferingCatalogItem = {
  id: string;
  kind: ReservationOfferingKind;
  display_name: string;
  price_eur: number | null;
  source_id: string;
  segundos: {
    id: string;
    code: string;
    nombre: string;
    descripcion: string;
    needsDonenessPoints: boolean;
    menu_item_id?: string;
  }[];
};

type ExistingOffering = {
  id: string;
  offering_kind: ReservationOfferingKind;
  cheffing_menu_id: string | null;
  cheffing_card_id: string | null;
  assigned_pax: number;
  display_name_snapshot: string;
  notes: string | null;
  sort_order: number;
};

type ExistingOfferingSelection = {
  id: string;
  group_event_offering_id: string;
  selection_kind: 'menu_second' | 'custom_menu' | 'kids_menu';
  cheffing_dish_id: string | null;
  cheffing_menu_item_id: string | null;
  display_name_snapshot: string;
  description_snapshot: string | null;
  quantity: number;
  notes: string | null;
  needs_doneness_points: boolean;
  sort_order: number;
};

type ExistingOfferingSelectionDoneness = {
  id: string;
  selection_id: string;
  point: DonenessPoint;
  quantity: number;
};

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

type CustomSecondKind = 'custom_menu' | 'kids_menu';

type CustomSecond = {
  id: string;
  name: string;
  cantidad: number;
  kind: CustomSecondKind;
  notes?: string;
};

type SelectedSecond = {
  dishId: string;
  menuItemId: string | null;
  nombre: string;
  descripcion: string;
  needsDonenessPoints: boolean;
  cantidad: number;
  notes?: string | null;
};

type Props = {
  reservation: EditableReservation;
  offerings: ExistingOffering[];
  offeringSelections: ExistingOfferingSelection[];
  selectionDoneness: ExistingOfferingSelectionDoneness[];
  backDate?: string | null;
};

const DONENESS_LABELS: Record<DonenessPoint, string> = {
  crudo: 'Crudo',
  poco: 'Poco hecho',
  al_punto: 'Al punto',
  hecho: 'Hecho',
  muy_hecho: 'Muy hecho',
};

const DONENESS_ORDER: DonenessPoint[] = ['crudo', 'poco', 'al_punto', 'hecho', 'muy_hecho'];

const buildOfferingCatalogId = (kind: ReservationOfferingKind, sourceId: string) => `${kind}:${sourceId}`;

export function EditableReservationForm({
  reservation,
  offerings,
  offeringSelections,
  selectionDoneness,
  backDate,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<EditableReservation>(reservation);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [offeringCatalog, setOfferingCatalog] = useState<ReservationOfferingCatalogItem[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);

  const primaryOffering = offerings[0] ?? null;
  const defaultOfferingCatalogId = primaryOffering
    ? buildOfferingCatalogId(
        primaryOffering.offering_kind,
        primaryOffering.offering_kind === 'cheffing_menu'
          ? (primaryOffering.cheffing_menu_id as string)
          : (primaryOffering.cheffing_card_id as string),
      )
    : '';

  const [selectedOfferingId, setSelectedOfferingId] = useState(defaultOfferingCatalogId);
  const [assignedPax, setAssignedPax] = useState<number>(primaryOffering?.assigned_pax ?? Math.max(1, reservation.adults ?? 1));
  const [segundosSeleccionados, setSegundosSeleccionados] = useState<SelectedSecond[]>([]);
  const [customSeconds, setCustomSeconds] = useState<CustomSecond[]>([]);
  const [donenessByDishId, setDonenessByDishId] = useState<Record<string, Record<DonenessPoint, number>>>({});
  const [structuredEditorTouched, setStructuredEditorTouched] = useState(false);

  const hasStructuredData = offerings.length > 0;
  const hasMultipleOfferings = offerings.length > 1;

  const inactiveHistoricalOfferings = useMemo(() => {
    return offerings
      .filter((offering) => {
        const sourceId = offering.offering_kind === 'cheffing_menu' ? offering.cheffing_menu_id : offering.cheffing_card_id;
        if (!sourceId) return false;
        return !offeringCatalog.some(
          (catalogOffering) =>
            catalogOffering.kind === offering.offering_kind && catalogOffering.source_id === sourceId,
        );
      })
      .map((offering) => {
        const sourceId = offering.offering_kind === 'cheffing_menu' ? offering.cheffing_menu_id : offering.cheffing_card_id;
        return {
          id: buildOfferingCatalogId(offering.offering_kind, sourceId as string),
          kind: offering.offering_kind,
          display_name: `${offering.display_name_snapshot} (inactivo)`,
          price_eur: null,
          source_id: sourceId as string,
          segundos: [],
        } as ReservationOfferingCatalogItem;
      });
  }, [offeringCatalog, offerings]);

  const selectableOfferingCatalog = useMemo(() => {
    const map = new Map<string, ReservationOfferingCatalogItem>();
    [...offeringCatalog, ...inactiveHistoricalOfferings].forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [inactiveHistoricalOfferings, offeringCatalog]);

  const selectedOffering = useMemo(
    () => selectableOfferingCatalog.find((offering) => offering.id === selectedOfferingId) ?? null,
    [selectableOfferingCatalog, selectedOfferingId],
  );

  const isSelectedOfferingMenu = selectedOffering?.kind === 'cheffing_menu';
  const isSelectedOfferingInactive = useMemo(
    () => Boolean(selectedOffering && !offeringCatalog.some((offering) => offering.id === selectedOffering.id)),
    [offeringCatalog, selectedOffering],
  );
  const canEditStructuredOffering = !hasMultipleOfferings;
  const canEditMenuDetails =
    canEditStructuredOffering &&
    isSelectedOfferingMenu &&
    (!isSelectedOfferingInactive || (selectedOffering?.segundos.length ?? 0) > 0);

  const computedTotalPax = (form.adults ?? 0) + (form.children ?? 0);

  const handleChange = (key: keyof EditableReservation, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value } as EditableReservation));
  };

  const resetMenuDependentState = useCallback(() => {
    setSegundosSeleccionados([]);
    setCustomSeconds([]);
    setDonenessByDishId({});
  }, []);

  const hydrateStateFromExistingStructure = useCallback(() => {
    if (!primaryOffering) return;

    const offeringSelectionsForPrimary = offeringSelections
      .filter((selection) => selection.group_event_offering_id === primaryOffering.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const existingSeconds = offeringSelectionsForPrimary
      .filter((selection) => selection.selection_kind === 'menu_second')
      .map((selection) => ({
        dishId: selection.cheffing_dish_id ?? selection.id,
        menuItemId: selection.cheffing_menu_item_id,
        nombre: selection.display_name_snapshot,
        descripcion: selection.description_snapshot ?? '',
        needsDonenessPoints: selection.needs_doneness_points,
        cantidad: selection.quantity,
        notes: selection.notes,
      }));

    const existingCustomSeconds = offeringSelectionsForPrimary
      .filter((selection) => selection.selection_kind === 'custom_menu' || selection.selection_kind === 'kids_menu')
      .map((selection) => ({
        id: selection.id,
        name: selection.display_name_snapshot,
        cantidad: selection.quantity,
        kind: selection.selection_kind as CustomSecondKind,
        notes: selection.notes ?? undefined,
      }));

    const donenessMap = offeringSelectionsForPrimary.reduce<Record<string, Record<DonenessPoint, number>>>(
      (acc, selection) => {
        if (selection.selection_kind !== 'menu_second' || !selection.needs_doneness_points) return acc;
        const dishId = selection.cheffing_dish_id ?? selection.id;
        const points = selectionDoneness
          .filter((point) => point.selection_id === selection.id)
          .reduce<Record<DonenessPoint, number>>(
            (pointAcc, point) => ({
              ...pointAcc,
              [point.point]: point.quantity,
            }),
            { crudo: 0, poco: 0, al_punto: 0, hecho: 0, muy_hecho: 0 },
          );
        acc[dishId] = points;
        return acc;
      },
      {},
    );

    setSegundosSeleccionados(existingSeconds);
    setCustomSeconds(existingCustomSeconds);
    setDonenessByDishId(donenessMap);
  }, [offeringSelections, primaryOffering, selectionDoneness]);

  const handleSegundoChange = (
    segundo: ReservationOfferingCatalogItem['segundos'][number],
    cantidad: number,
  ) => {
    setStructuredEditorTouched(true);
    setSegundosSeleccionados((prev) => {
      const existing = prev.find((entry) => entry.dishId === segundo.id);
      if (existing) {
        return prev.map((entry) =>
          entry.dishId === segundo.id
            ? {
                ...entry,
                cantidad,
                menuItemId: segundo.menu_item_id ?? null,
                nombre: segundo.nombre,
                descripcion: segundo.descripcion,
                needsDonenessPoints: segundo.needsDonenessPoints,
              }
            : entry,
        );
      }

      return [
        ...prev,
        {
          dishId: segundo.id,
          menuItemId: segundo.menu_item_id ?? null,
          nombre: segundo.nombre,
          descripcion: segundo.descripcion,
          needsDonenessPoints: segundo.needsDonenessPoints,
          cantidad,
        },
      ];
    });
  };

  const updateDonenessPoint = (dishId: string, point: DonenessPoint, value: number) => {
    setStructuredEditorTouched(true);
    setDonenessByDishId((prev) => ({
      ...prev,
      [dishId]: {
        crudo: prev[dishId]?.crudo ?? 0,
        poco: prev[dishId]?.poco ?? 0,
        al_punto: prev[dishId]?.al_punto ?? 0,
        hecho: prev[dishId]?.hecho ?? 0,
        muy_hecho: prev[dishId]?.muy_hecho ?? 0,
        [point]: Math.max(0, value),
      },
    }));
  };

  const addCustomSecond = (kind: CustomSecondKind) => {
    setStructuredEditorTouched(true);
    setCustomSeconds((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind,
        name: kind === 'kids_menu' ? 'Menú infantil' : 'Menú personalizado',
        cantidad: 1,
      },
    ]);
  };

  const updateCustomSecond = (id: string, updates: Partial<CustomSecond>) => {
    setStructuredEditorTouched(true);
    setCustomSeconds((prev) => prev.map((custom) => (custom.id === id ? { ...custom, ...updates } : custom)));
  };

  const removeCustomSecond = (id: string) => {
    setStructuredEditorTouched(true);
    setCustomSeconds((prev) => prev.filter((custom) => custom.id !== id));
  };

  const includeOfferingAssignments = hasStructuredData || structuredEditorTouched;
  const totalAssignedMenus = useMemo(
    () =>
      segundosSeleccionados.filter((selection) => selection.cantidad > 0).reduce((sum, selection) => sum + selection.cantidad, 0) +
      customSeconds.reduce((sum, custom) => sum + custom.cantidad, 0),
    [customSeconds, segundosSeleccionados],
  );
  const paxMismatchWarning =
    canEditStructuredOffering && isSelectedOfferingMenu && totalAssignedMenus !== assignedPax
      ? `Hay ${assignedPax} pax asignados a la oferta, pero ${totalAssignedMenus} menús/platos repartidos (segundos + personalizados + infantiles).`
      : null;
  const donenessMismatchWarnings = useMemo(() => {
    if (!canEditStructuredOffering || !isSelectedOfferingMenu) return [];

    return segundosSeleccionados
      .filter((selection) => selection.cantidad > 0 && selection.needsDonenessPoints)
      .map((selection) => {
        const points = donenessByDishId[selection.dishId] ?? {
          crudo: 0,
          poco: 0,
          al_punto: 0,
          hecho: 0,
          muy_hecho: 0,
        };
        const totalPoints = DONENESS_ORDER.reduce((sum, point) => sum + (points[point] ?? 0), 0);
        if (totalPoints === selection.cantidad) return null;
        return `${selection.nombre}: ${selection.cantidad} uds, puntos de cocción ${totalPoints}.`;
      })
      .filter((warning): warning is string => warning !== null);
  }, [canEditStructuredOffering, donenessByDishId, isSelectedOfferingMenu, segundosSeleccionados]);
  const hasStructuredWarnings = Boolean(paxMismatchWarning) || donenessMismatchWarnings.length > 0;

  const handleSubmit = async () => {
    setMessage(null);
    setError(null);
    setCalendarWarning(null);

    startTransition(async () => {
      try {
        let payload: Record<string, unknown> = { ...form };

        if (includeOfferingAssignments && selectedOffering && canEditStructuredOffering) {
          if (hasStructuredWarnings && isSelectedOfferingMenu) {
            const proceed = window.confirm(
              'Hay descuadres de pax o puntos de cocción en la estructura de cocina. ¿Quieres guardar igualmente?',
            );
            if (!proceed) {
              return;
            }
          }

          const secondSelections = isSelectedOfferingMenu
            ? [
                ...segundosSeleccionados
                  .filter((selection) => selection.cantidad > 0)
                  .map((selection, index) => {
                    const donenessRecord = donenessByDishId[selection.dishId] ?? {
                      crudo: 0,
                      poco: 0,
                      al_punto: 0,
                      hecho: 0,
                      muy_hecho: 0,
                    };
                    const doneness = DONENESS_ORDER.map((point) => ({ point, quantity: donenessRecord[point] ?? 0 })).filter(
                      (item) => item.quantity > 0,
                    );

                    return {
                      selectionKind: 'menu_second',
                      dishId: selection.dishId,
                      menuItemId: selection.menuItemId,
                      displayName: selection.nombre,
                      description: selection.descripcion,
                      quantity: Math.max(1, selection.cantidad),
                      notes: selection.notes ?? null,
                      needsDonenessPoints: selection.needsDonenessPoints,
                      sortOrder: index,
                      doneness,
                    };
                  }),
                ...customSeconds.map((custom, index) => ({
                  selectionKind: custom.kind,
                  displayName: custom.name.trim() || (custom.kind === 'kids_menu' ? 'Menú infantil' : 'Menú personalizado'),
                  quantity: Math.max(1, custom.cantidad),
                  notes: custom.notes?.trim() || null,
                  sortOrder: segundosSeleccionados.length + index,
                })),
              ]
            : [];

          payload = {
            ...payload,
            offeringAssignments: [
              {
                offeringKind: selectedOffering.kind,
                offeringId: selectedOffering.source_id,
                assignedPax: Math.max(1, assignedPax || 1),
                sortOrder: 0,
                notes: null,
                ...(isSelectedOfferingMenu ? { secondSelections } : {}),
              },
            ],
          };
        }

        const res = await fetch('/api/group-events/update', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'No se pudo guardar la reserva');
        }

        try {
          const resCalendar = await fetch('/api/calendar-sync', {
            method: 'POST',
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ groupEventId: form.id }),
          });

          if (!resCalendar.ok) {
            console.error(
              '[Editar reserva] Error sincronizando con Google Calendar',
              resCalendar.statusText,
            );
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
        router.refresh();
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

  useEffect(() => {
    const loadOfferings = async () => {
      setOfferingsLoading(true);
      setOfferingsError(null);

      try {
        const response = await fetch('/api/reservas/offering-catalog', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as { offerings?: ReservationOfferingCatalogItem[] };
        setOfferingCatalog(data.offerings ?? []);
      } catch (loadError) {
        console.error('[Editar reserva] Error cargando catálogo de ofertas', loadError);
        setOfferingsError('No se ha podido cargar el catálogo de ofertas.');
      } finally {
        setOfferingsLoading(false);
      }
    };

    void loadOfferings();
  }, []);

  useEffect(() => {
    hydrateStateFromExistingStructure();
  }, [hydrateStateFromExistingStructure]);

  useEffect(() => {
    if (selectedOfferingId || selectableOfferingCatalog.length === 0) return;
    setSelectedOfferingId(selectableOfferingCatalog[0].id);
  }, [selectableOfferingCatalog, selectedOfferingId]);

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
              <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Fecha</label>
                <input type="date" value={form.event_date} onChange={(e) => handleChange('event_date', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Hora</label>
                <input type="time" value={form.entry_time} onChange={(e) => handleChange('entry_time', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Adultos</label>
              <input type="number" value={form.adults ?? ''} onChange={(e) => handleChange('adults', parseNumber(e.target.value))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Niños</label>
              <input type="number" value={form.children ?? ''} onChange={(e) => handleChange('children', parseNumber(e.target.value))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Total pax (calculado)</label>
              <input type="number" value={computedTotalPax} readOnly className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 cursor-not-allowed" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-100">
              <input type="checkbox" checked={form.has_private_dining_room} onChange={(e) => handleChange('has_private_dining_room', e.target.checked)} className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500" />
              Sala privada
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-100">
              <input type="checkbox" checked={form.has_private_party} onChange={(e) => handleChange('has_private_party', e.target.checked)} className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500" />
              Fiesta privada
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Menú y cocina</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm text-slate-200 md:col-span-2">
              <span className="label text-xs">Oferta principal</span>
              <select
                value={selectedOfferingId}
                onChange={(e) => {
                  if (!canEditStructuredOffering) return;
                  setStructuredEditorTouched(true);
                  setSelectedOfferingId(e.target.value);
                  setAssignedPax(Math.max(1, form.adults ?? 1));
                  resetMenuDependentState();
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                disabled={!canEditStructuredOffering || offeringsLoading || selectableOfferingCatalog.length === 0}
              >
                {selectableOfferingCatalog.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.display_name} {offering.kind === 'cheffing_card' ? '· Carta' : '· Menú'}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-200">
              <span className="label text-xs">Pax asignado</span>
              <input
                type="number"
                min={1}
                value={assignedPax}
                onChange={(e) => {
                  if (!canEditStructuredOffering) return;
                  setStructuredEditorTouched(true);
                  setAssignedPax(Math.max(1, Number(e.target.value) || 1));
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                disabled={!canEditStructuredOffering}
              />
            </label>
          </div>

          {hasMultipleOfferings && (
            <div className="rounded-lg border border-amber-700/70 bg-amber-950/40 p-3 space-y-1">
              <p className="text-sm font-semibold text-amber-100">Edición estructurada protegida</p>
              <p className="text-xs text-amber-200/90">
                Esta reserva tiene múltiples ofertas. Esta pantalla aún no soporta su edición estructurada completa.
                Puedes editar campos generales, pero no se enviarán cambios de offerings/selecciones para evitar sobrescrituras.
              </p>
            </div>
          )}

          {isSelectedOfferingInactive && (
            <div className="rounded-lg border border-amber-700/70 bg-amber-950/30 p-3 space-y-1">
              <p className="text-sm font-semibold text-amber-100">Oferta histórica inactiva</p>
              <p className="text-xs text-amber-200/90">
                Esta oferta está inactiva. Puedes conservarla o sustituirla por una oferta activa. Si no hay catálogo
                activo disponible, la edición detallada puede quedar limitada.
              </p>
            </div>
          )}

          {offeringsError && <p className="text-xs text-red-300">{offeringsError}</p>}

          {isSelectedOfferingMenu && selectedOffering && canEditMenuDetails && (
            <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <p className="text-sm font-medium text-slate-200">Detalle cocina</p>

              <div className="space-y-2">
                {selectedOffering.segundos.map((segundo) => {
                  const selected = segundosSeleccionados.find((entry) => entry.dishId === segundo.id);
                  const donenessValues = donenessByDishId[segundo.id] ?? {
                    crudo: 0,
                    poco: 0,
                    al_punto: 0,
                    hecho: 0,
                    muy_hecho: 0,
                  };

                  return (
                    <div key={segundo.id} className="rounded-md border border-slate-800/60 bg-slate-900/40 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{segundo.nombre}</p>
                          <p className="text-xs text-slate-400">{segundo.descripcion}</p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={selected?.cantidad ?? 0}
                          onChange={(e) => handleSegundoChange(segundo, Math.max(0, Number(e.target.value) || 0))}
                          className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                        />
                      </div>

                      {segundo.needsDonenessPoints && (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                          {DONENESS_ORDER.map((point) => (
                            <label key={point} className="text-xs text-slate-300 space-y-1">
                              <span>{DONENESS_LABELS[point]}</span>
                              <input
                                type="number"
                                min={0}
                                value={donenessValues[point]}
                                onChange={(e) => updateDonenessPoint(segundo.id, point, Number(e.target.value) || 0)}
                                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200">Menús personalizados e infantiles</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => addCustomSecond('custom_menu')} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800">
                      + Personalizado
                    </button>
                    <button type="button" onClick={() => addCustomSecond('kids_menu')} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800">
                      + Infantil
                    </button>
                  </div>
                </div>

                {customSeconds.map((custom) => (
                  <div key={custom.id} className="grid grid-cols-1 gap-2 rounded-md border border-slate-800/60 bg-slate-900/40 p-3 md:grid-cols-12">
                    <input
                      value={custom.name}
                      onChange={(e) => updateCustomSecond(custom.id, { name: e.target.value })}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 md:col-span-6"
                    />
                    <input
                      type="number"
                      min={1}
                      value={custom.cantidad}
                      onChange={(e) => updateCustomSecond(custom.id, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 md:col-span-2"
                    />
                    <input
                      value={custom.notes ?? ''}
                      onChange={(e) => updateCustomSecond(custom.id, { notes: e.target.value })}
                      placeholder="Notas"
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 md:col-span-3"
                    />
                    <button type="button" onClick={() => removeCustomSecond(custom.id)} className="rounded border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950 md:col-span-1">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSelectedOfferingMenu && selectedOffering && !canEditMenuDetails && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-300">
              {hasMultipleOfferings
                ? 'Esta reserva está en modo protegido por múltiples ofertas. El detalle de cocina se muestra en solo lectura.'
                : 'Este menú histórico no tiene catálogo activo de segundos. Para editar detalle, cambia a un menú activo.'}
            </div>
          )}

          {selectedOffering?.kind === 'cheffing_card' && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-300">
              Oferta tipo carta: no aplica edición de segundos, menús personalizados ni puntos de cocción.
            </div>
          )}

          {paxMismatchWarning && (
            <div className="rounded-md border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              {paxMismatchWarning}
            </div>
          )}
          {donenessMismatchWarnings.length > 0 && (
            <div className="rounded-md border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              <p className="font-semibold">Descuadre en puntos de cocción:</p>
              <ul className="list-disc pl-5">
                {donenessMismatchWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {hasStructuredData && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 space-y-2">
              <p className="text-sm font-medium text-slate-200">Estructura guardada (solo lectura)</p>
              {offerings.map((offering) => {
                const offeringSelectionRows = offeringSelections
                  .filter((selection) => selection.group_event_offering_id === offering.id)
                  .sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <div key={offering.id} className="rounded border border-slate-800/60 bg-slate-900/30 p-2 text-xs text-slate-300">
                    <p className="font-semibold text-slate-100">
                      {offering.display_name_snapshot} · {offering.assigned_pax} pax
                    </p>
                    {offeringSelectionRows.length === 0 ? (
                      <p className="text-slate-400">Sin selecciones detalladas.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {offeringSelectionRows.map((selection) => {
                          const points = selectionDoneness
                            .filter((point) => point.selection_id === selection.id)
                            .sort(
                              (a, b) =>
                                DONENESS_ORDER.indexOf(a.point as DonenessPoint) -
                                DONENESS_ORDER.indexOf(b.point as DonenessPoint),
                            );
                          return (
                            <li key={selection.id}>
                              {selection.quantity}× {selection.display_name_snapshot}
                              {points.length > 0 &&
                                ` · ${points.map((point) => `${DONENESS_LABELS[point.point]} (${point.quantity})`).join(' · ')}`}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 space-y-2">
            <p className="text-sm font-medium text-slate-200">Resumen estructurado</p>
            <p className="text-xs text-slate-400">
              Oferta: {selectedOffering?.display_name ?? '—'} · Pax asignado: {assignedPax}
            </p>
            {isSelectedOfferingMenu && (
              <ul className="space-y-1 text-xs text-slate-300">
                {segundosSeleccionados
                  .filter((selection) => selection.cantidad > 0)
                  .map((selection) => {
                    const points = donenessByDishId[selection.dishId];
                    const pointsText = points
                      ? DONENESS_ORDER.filter((point) => (points[point] ?? 0) > 0)
                          .map((point) => `${DONENESS_LABELS[point]} (${points[point]})`)
                          .join(' · ')
                      : '';

                    return (
                      <li key={selection.dishId}>
                        {selection.cantidad}× {selection.nombre}
                        {pointsText ? ` · ${pointsText}` : ''}
                      </li>
                    );
                  })}
                {customSeconds.map((custom) => (
                  <li key={custom.id}>
                    {custom.cantidad}× {custom.name} ({custom.kind === 'kids_menu' ? 'infantil' : 'personalizado'})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Snapshot menú (solo lectura)</label>
              <input
                type="text"
                value={form.menu_text ?? ''}
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 cursor-not-allowed opacity-80"
              />
              <p className="text-xs text-slate-500">Campo de compatibilidad para calendarios/cocina/tareas.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Segundo plato (legacy)</label>
              <input
                type="text"
                value={form.second_course_type ?? ''}
                onChange={(e) => handleChange('second_course_type', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Alergias y dietas</label>
              <textarea value={form.allergens_and_diets ?? ''} onChange={(e) => handleChange('allergens_and_diets', e.target.value)} className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Extras (cocina)</label>
              <textarea value={form.extras ?? ''} onChange={(e) => handleChange('extras', e.target.value)} className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Montaje y sala</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Montaje / sala</label>
            <textarea value={form.setup_notes ?? ''} onChange={(e) => handleChange('setup_notes', e.target.value)} className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Facturación y depósito</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Datos de factura</label>
              <textarea value={form.invoice_data ?? ''} onChange={(e) => handleChange('invoice_data', e.target.value)} className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Depósito (€)</label>
                <input type="number" value={form.deposit_amount ?? ''} onChange={(e) => handleChange('deposit_amount', parseNumber(e.target.value))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Estado depósito</label>
                <input type="text" value={form.deposit_status ?? ''} onChange={(e) => handleChange('deposit_status', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Estado</label>
              <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                <option value="draft">Borrador</option>
                <option value="confirmed">Confirmado</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleSubmit} disabled={isPending} className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
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
