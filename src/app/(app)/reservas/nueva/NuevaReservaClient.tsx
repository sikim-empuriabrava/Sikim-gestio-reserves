'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Turno } from '@/types/reservation';
import { CalendarDaysIcon, CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type ReservationOfferingKind = 'cheffing_menu' | 'cheffing_card';

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

type EntrecotPoints = {
  crudo: number;
  poco: number;
  alPunto: number;
  hecho: number;
  muyHecho: number;
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
};

type RoomOption = {
  id: string;
  name: string;
};

function ReservasNewPilotStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          body:has(.reservas-new-pilot) {
            background: #11100e;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) {
            max-width: none;
            gap: 0;
            padding: 0;
            background:
              radial-gradient(circle at 18% 0%, rgba(156, 117, 70, 0.10), transparent 26rem),
              linear-gradient(135deg, #171614 0%, #11100e 52%, #0f0e0d 100%);
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > aside {
            width: 18.5rem;
            border-right: 1px solid rgba(120, 103, 82, 0.30);
            background: linear-gradient(180deg, rgba(29, 28, 25, 0.98), rgba(20, 19, 17, 0.98));
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > aside > div {
            top: 0;
            min-height: 100dvh;
            padding: 1rem;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > div {
            min-width: 0;
            gap: 0;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > div > header {
            border-radius: 0;
            border-width: 0 0 1px 0;
            border-color: rgba(120, 103, 82, 0.28);
            background: rgba(18, 17, 15, 0.88);
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > div > header > div > div:first-child {
            display: none;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > div > header > div {
            justify-content: flex-end;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) footer {
            display: none;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) aside nav > div {
            border-color: rgba(120, 103, 82, 0.22);
            background: transparent;
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) aside nav button {
            background: rgba(28, 27, 24, 0.62);
            color: #efe8dc;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) aside nav a[aria-current="page"] {
            background: rgba(150, 112, 66, 0.22);
            color: #f1c98f;
            box-shadow: inset 0 0 0 1px rgba(194, 144, 82, 0.20);
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) a {
            color: inherit;
          }

          .reservas-new-pilot .card {
            border-color: rgba(74, 63, 50, 0.72);
            background: rgba(24, 23, 21, 0.95);
            box-shadow: 0 24px 80px -56px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.035);
            backdrop-filter: none;
          }

          .reservas-new-pilot .input {
            border-color: rgba(74, 63, 50, 0.82);
            background: rgba(18, 17, 15, 0.90);
            color: #f4ede3;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
          }

          .reservas-new-pilot .input::placeholder {
            color: #786f64;
          }

          .reservas-new-pilot .input:focus {
            border-color: rgba(214, 167, 110, 0.78);
            outline: none;
            box-shadow: 0 0 0 2px rgba(214, 167, 110, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.035);
          }

          .reservas-new-pilot .label {
            color: #cfc4b5;
            font-weight: 500;
          }

          .reservas-new-pilot [class*="text-slate-500"] {
            color: #786f64;
          }

          .reservas-new-pilot [class*="text-slate-400"] {
            color: #9d9285;
          }

          .reservas-new-pilot [class*="text-slate-300"],
          .reservas-new-pilot [class*="text-slate-200"],
          .reservas-new-pilot [class*="text-slate-100"],
          .reservas-new-pilot .text-white {
            color: #efe8dc;
          }

          .reservas-new-pilot [class*="border-slate-800"],
          .reservas-new-pilot [class*="border-slate-700"] {
            border-color: rgba(74, 63, 50, 0.72);
          }

          .reservas-new-pilot [class*="bg-slate-950"] {
            background-color: rgba(18, 17, 15, 0.78);
          }

          .reservas-new-pilot [class*="bg-slate-900"],
          .reservas-new-pilot [class*="bg-slate-800"] {
            background-color: rgba(31, 29, 25, 0.74);
          }

          .reservas-new-pilot [class*="text-primary"] {
            color: #f0c58b;
          }

          .reservas-new-pilot [class*="bg-primary"] {
            background-color: rgba(125, 89, 50, 0.30);
          }

          .reservas-new-pilot [class*="border-primary"] {
            border-color: rgba(214, 167, 110, 0.38);
          }

          .reservas-new-pilot .button-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            border-radius: 0.75rem;
            border: 1px solid rgba(225, 181, 121, 0.55);
            background: #d9b27c;
            color: #19120b;
            padding: 0.75rem 1.25rem;
            font-size: 0.875rem;
            font-weight: 700;
            transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
          }

          .reservas-new-pilot .button-primary:hover {
            background: #e4bf89;
            border-color: rgba(239, 202, 146, 0.75);
          }

          .reservas-new-pilot .button-primary:active {
            transform: translateY(1px);
          }

          .reservas-new-pilot .button-primary:disabled {
            opacity: 0.58;
            cursor: not-allowed;
          }

          .reservas-new-pilot .button-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            border-radius: 0.75rem;
            border: 1px solid rgba(74, 63, 50, 0.85);
            background: rgba(21, 20, 18, 0.86);
            color: #efe8dc;
            padding: 0.625rem 0.95rem;
            font-size: 0.875rem;
            font-weight: 600;
            transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
          }

          .reservas-new-pilot .button-secondary:hover {
            border-color: rgba(139, 106, 67, 0.70);
            background: #211f1b;
          }
        `,
      }}
    />
  );
}

export default function NuevaReservaClient() {
  const router = useRouter();
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));
  const [turno, setTurno] = useState<Turno>('cena');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [numeroPersonas, setNumeroPersonas] = useState(2);
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [intolerancias, setIntolerancias] = useState('');
  const [notasSala, setNotasSala] = useState('');
  const [notasCocina, setNotasCocina] = useState('');
  const [mesa, setMesa] = useState('');
  const [segundosSeleccionados, setSegundosSeleccionados] = useState<SelectedSecond[]>([]);
  const [entrecotPoints, setEntrecotPoints] = useState<EntrecotPoints>({
    crudo: 0,
    poco: 0,
    alPunto: 0,
    hecho: 0,
    muyHecho: 0,
  });
  const [customSeconds, setCustomSeconds] = useState<CustomSecond[]>([]);
  const [isCustomMenuModalOpen, setIsCustomMenuModalOpen] = useState(false);
  const [isKidsMenuModalOpen, setIsKidsMenuModalOpen] = useState(false);
  const [customMenuName, setCustomMenuName] = useState('');
  const [customMenuCantidad, setCustomMenuCantidad] = useState(1);
  const [customMenuNotes, setCustomMenuNotes] = useState('');
  const [kidsMenuName, setKidsMenuName] = useState('Menú infantil');
  const [kidsMenuCantidad, setKidsMenuCantidad] = useState(1);
  const [kidsMenuNotes, setKidsMenuNotes] = useState('');
  const [warningMenus, setWarningMenus] = useState<string | null>(null);
  const [warningEntrecot, setWarningEntrecot] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [loadRoomsError, setLoadRoomsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<ReservationOfferingCatalogItem[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [donenessCollapsed, setDonenessCollapsed] = useState(true);

  const selectedOffering = useMemo(
    () => offerings.find((offering) => offering.id === selectedOfferingId) ?? null,
    [offerings, selectedOfferingId],
  );
  const isSelectedOfferingMenu = selectedOffering?.kind === 'cheffing_menu';
  const customMenusCount = useMemo(
    () => customSeconds.reduce((sum, custom) => sum + custom.cantidad, 0),
    [customSeconds],
  );

  const updateEntrecotPoint = (key: keyof EntrecotPoints, value: number) => {
    setEntrecotPoints((prev) => ({
      ...prev,
      [key]: Math.max(0, value),
    }));
  };

  const handleSegundoChange = (
    segundo: ReservationOfferingCatalogItem['segundos'][number],
    cantidad: number,
  ) => {
    setSegundosSeleccionados((prev) => {
      const existing = prev.find((s) => s.dishId === segundo.id);
      if (existing) {
        return prev.map((s) =>
          s.dishId === segundo.id
            ? {
                ...s,
                cantidad,
                menuItemId: segundo.menu_item_id ?? null,
                descripcion: segundo.descripcion,
                needsDonenessPoints: segundo.needsDonenessPoints,
              }
            : s,
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

  const handleCreateCustomMenu = () => {
    if (!customMenuName.trim()) {
      return;
    }
    setCustomSeconds((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: 'custom_menu',
        name: customMenuName.trim(),
        cantidad: Math.max(1, customMenuCantidad || 1),
        notes: customMenuNotes.trim() || undefined,
      },
    ]);
    setCustomMenuName('');
    setCustomMenuCantidad(1);
    setCustomMenuNotes('');
    setIsCustomMenuModalOpen(false);
  };

  const handleCloseCustomMenuModal = () => {
    setCustomMenuName('');
    setCustomMenuCantidad(1);
    setCustomMenuNotes('');
    setIsCustomMenuModalOpen(false);
  };

  const handleCreateKidsMenu = () => {
    const trimmedName = kidsMenuName.trim() || 'Menú infantil';
    setCustomSeconds((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: 'kids_menu',
        name: trimmedName,
        cantidad: Math.max(1, kidsMenuCantidad || 1),
        notes: kidsMenuNotes.trim() || undefined,
      },
    ]);
    setKidsMenuName('Menú infantil');
    setKidsMenuCantidad(1);
    setKidsMenuNotes('');
    setIsKidsMenuModalOpen(false);
  };

  const handleCloseKidsMenuModal = () => {
    setKidsMenuName('Menú infantil');
    setKidsMenuCantidad(1);
    setKidsMenuNotes('');
    setIsKidsMenuModalOpen(false);
  };

  const updateCustomSecond = (id: string, updates: Partial<CustomSecond>) => {
    setCustomSeconds((prev) => prev.map((custom) => (custom.id === id ? { ...custom, ...updates } : custom)));
  };

  const resetMenuDependentState = useCallback(() => {
    setSegundosSeleccionados([]);
    setEntrecotPoints({
      crudo: 0,
      poco: 0,
      alPunto: 0,
      hecho: 0,
      muyHecho: 0,
    });
    setCustomSeconds([]);
    setWarningMenus(null);
    setWarningEntrecot(null);
    setDonenessCollapsed(true);
    setIsCustomMenuModalOpen(false);
    setIsKidsMenuModalOpen(false);
  }, []);

  const validateMenus = useCallback(() => {
    if (!isSelectedOfferingMenu || !selectedOffering) {
      setWarningMenus(null);
      setWarningEntrecot(null);
      return true;
    }

    const totalSegundosBase = segundosSeleccionados.reduce((sum, s) => sum + s.cantidad, 0);
    const totalCustom = customSeconds.reduce((sum, s) => sum + s.cantidad, 0);
    const totalMenusAsignados = totalSegundosBase + totalCustom;

    const totalPuntosEntrecot =
      entrecotPoints.crudo +
      entrecotPoints.poco +
      entrecotPoints.alPunto +
      entrecotPoints.hecho +
      entrecotPoints.muyHecho;

    const donenessSecondsIds = selectedOffering.segundos.filter((s) => s.needsDonenessPoints).map((s) => s.id);
    const donenessSelection = segundosSeleccionados.find((s) => donenessSecondsIds.includes(s.dishId));
    const totalDonenessPeople = donenessSelection?.cantidad ?? 0;

    if (totalMenusAsignados !== numeroPersonas) {
      setWarningMenus(
        `Hay ${numeroPersonas} personas pero has asignado ${totalMenusAsignados} menús. Revisa si falta alguien o si sobra algún menú.`,
      );
    } else {
      setWarningMenus(null);
    }

    if (totalDonenessPeople > 0 && totalPuntosEntrecot !== totalDonenessPeople) {
      setWarningEntrecot(
        `Has pedido ${totalDonenessPeople} platos con puntos de cocción pero la suma de puntos es ${totalPuntosEntrecot}.`,
      );
    } else {
      setWarningEntrecot(null);
    }

    return (
      totalMenusAsignados === numeroPersonas &&
      (totalDonenessPeople === 0 || totalPuntosEntrecot === totalDonenessPeople)
    );
  }, [customSeconds, entrecotPoints, isSelectedOfferingMenu, numeroPersonas, segundosSeleccionados, selectedOffering]);

  useEffect(() => {
    const loadOfferings = async () => {
      setOfferingsLoading(true);
      setOfferingsError(null);
      let responseStatus: number | null = null;
      try {
        const response = await fetch('/api/reservas/offering-catalog', { cache: 'no-store' });

        responseStatus = response.status;
        if (!response.ok) {
          const body = await response.text();
          console.error('menus load failed', response.status, body);
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          offerings?: ReservationOfferingCatalogItem[];
          error?: string;
        };
        const offeringsResponse = data.offerings ?? [];

        if (offeringsResponse.length === 0) {
          throw new Error(data.error ?? 'No se ha podido cargar el catálogo de ofertas.');
        }

        setOfferings(offeringsResponse);
        setSelectedOfferingId((prev) => prev || offeringsResponse[0]?.id || '');
      } catch (error) {
        console.error('[Nueva reserva] Error cargando catálogo de ofertas', error);
        setOfferingsError(
          `No se ha podido cargar el catálogo de ofertas.${responseStatus ? ` (status ${responseStatus})` : ''}`,
        );
      } finally {
        setOfferingsLoading(false);
      }
    };

    loadOfferings();
  }, []);

  useEffect(() => {
    const loadRooms = async () => {
      setIsLoadingRooms(true);
      setLoadRoomsError(null);
      try {
        const response = await fetch('/api/rooms', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as { rooms?: RoomOption[]; error?: string };
        const roomsResponse = data.rooms ?? [];

        if (roomsResponse.length === 0) {
          throw new Error(data.error ?? 'No se han podido cargar las salas.');
        }

        setRooms(roomsResponse);
        if (roomsResponse.length > 0) {
          setRoomId((prev) => prev || roomsResponse[0].id);
        }
      } catch (error) {
        console.error('[Nueva reserva] Error cargando rooms', error);
        setLoadRoomsError('No se han podido cargar las salas.');
      } finally {
        setIsLoadingRooms(false);
      }
    };

    loadRooms();
  }, []);

  useEffect(() => {
    validateMenus();
  }, [validateMenus]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setCalendarWarning(null);
    setIsSubmitting(true);

    if (!roomId) {
      setSubmitError('Selecciona una sala para continuar.');
      setIsSubmitting(false);
      return;
    }

    const [datePart, timePart] = fecha.split('T');
    const eventDate = datePart;
    const entryTime = timePart ? `${timePart}:00` : null;

    const selectedOfferingSnapshot = selectedOffering;

    const isValid = validateMenus();

    if (!isValid) {
      const proceed = window.confirm(
        'Hay descuadres entre número de personas, menús asignados o puntos de cocción. ¿Quieres guardar la reserva igualmente?',
      );

      if (!proceed) {
        setIsSubmitting(false);
        return;
      }
    }

    let menuText: string | null = null;

    if (selectedOfferingSnapshot?.kind === 'cheffing_card') {
      menuText = `${selectedOfferingSnapshot.display_name} · ${numeroPersonas} pax`;
    }

    if (selectedOfferingSnapshot?.kind === 'cheffing_menu') {
      const donenessSecondsIds = selectedOfferingSnapshot.segundos
        .filter((s) => s.needsDonenessPoints)
        .map((s) => s.id);
      const donenessSelection = segundosSeleccionados.find((s) => donenessSecondsIds.includes(s.dishId));
      const totalDonenessPeople = donenessSelection?.cantidad ?? 0;
      const segundosBaseTexto = segundosSeleccionados
        .filter((s) => s.cantidad > 0)
        .map((s) => `- ${s.nombre}: ${s.cantidad}`)
        .join('\n');

      let detalleEntrecot: string | null = null;

      if (totalDonenessPeople > 0) {
        const partes: string[] = [];

        if (entrecotPoints.crudo > 0) partes.push(`Crudo: ${entrecotPoints.crudo}`);
        if (entrecotPoints.poco > 0) partes.push(`Poco hecho: ${entrecotPoints.poco}`);
        if (entrecotPoints.alPunto > 0) partes.push(`Al punto: ${entrecotPoints.alPunto}`);
        if (entrecotPoints.hecho > 0) partes.push(`Hecho: ${entrecotPoints.hecho}`);
        if (entrecotPoints.muyHecho > 0) partes.push(`Muy hecho: ${entrecotPoints.muyHecho}`);

        if (partes.length > 0) {
          detalleEntrecot = `Puntos de cocción:\n${partes.map((p) => `  · ${p}`).join('\n')}`;
        }
      }

      const customMenus = customSeconds.filter((s) => s.kind === 'custom_menu');
      const kidsMenus = customSeconds.filter((s) => s.kind === 'kids_menu');

      const customMenusTexto =
        customMenus.length > 0
          ? [
              'Menús personalizados:',
              ...customMenus.map(
                (s) => `- ${s.name}: ${s.cantidad}${s.notes ? ` — ${s.notes}` : ''}`,
              ),
            ].join('\n')
          : null;

      const kidsMenusTexto =
        kidsMenus.length > 0
          ? [
              'Menús infantiles:',
              ...kidsMenus.map(
                (s) => `- ${s.name}: ${s.cantidad}${s.notes ? ` — ${s.notes}` : ''}`,
              ),
            ].join('\n')
          : null;

      const partesMenuText = [
        `Menú asignado: ${selectedOfferingSnapshot.display_name}`,
        segundosBaseTexto ? 'Plato principal:' : null,
        segundosBaseTexto || null,
        detalleEntrecot,
        customMenusTexto,
        kidsMenusTexto,
      ];

      menuText = partesMenuText
        .filter((p) => p && p.toString().trim().length > 0)
        .join('\n\n') || null;
    }

    const setupNotesLines = [
      mesa ? `Mesa / zona: ${mesa}` : null,
      notasSala ? `Notas sala: ${notasSala}` : null,
    ].filter(Boolean);

    const setupNotes = setupNotesLines.length > 0 ? setupNotesLines.join('\n') : null;

    const extras = notasCocina ? `Notas cocina: ${notasCocina}` : null;

    const secondSelections =
      selectedOfferingSnapshot?.kind === 'cheffing_menu'
        ? [
            ...selectedOfferingSnapshot.segundos
              .map((segundo, index) => {
                const selected = segundosSeleccionados.find((entry) => entry.dishId === segundo.id);
                if (!selected || selected.cantidad <= 0) {
                  return null;
                }

                const doneness = segundo.needsDonenessPoints
                  ? [
                      { point: 'crudo', quantity: entrecotPoints.crudo },
                      { point: 'poco', quantity: entrecotPoints.poco },
                      { point: 'al_punto', quantity: entrecotPoints.alPunto },
                      { point: 'hecho', quantity: entrecotPoints.hecho },
                      { point: 'muy_hecho', quantity: entrecotPoints.muyHecho },
                    ].filter((point) => point.quantity > 0)
                  : [];

                return {
                  selectionKind: 'menu_second',
                  dishId: segundo.id,
                  menuItemId: segundo.menu_item_id ?? null,
                  quantity: selected.cantidad,
                  notes: null,
                  sortOrder: index,
                  doneness,
                };
              })
              .filter((selection): selection is NonNullable<typeof selection> => selection !== null),
            ...customSeconds.map((custom, index) => ({
              selectionKind: custom.kind,
              displayName: custom.name.trim() || (custom.kind === 'kids_menu' ? 'Menú infantil' : 'Menú personalizado'),
              quantity: Math.max(1, custom.cantidad),
              notes: custom.notes?.trim() || null,
              sortOrder: selectedOfferingSnapshot.segundos.length + index,
            })),
          ]
        : [];

    const offeringAssignments = selectedOfferingSnapshot
      ? [
          {
            offeringKind: selectedOfferingSnapshot.kind,
            offeringId: selectedOfferingSnapshot.source_id,
            assignedPax: Math.max(1, numeroPersonas),
            sortOrder: 0,
            notes: null,
            secondSelections: selectedOfferingSnapshot.kind === 'cheffing_menu' ? secondSelections : undefined,
          },
        ]
      : undefined;

    try {
      const resCreate = await fetch('/api/group-events/create', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: nombreCliente || 'Grupo sin nombre',
          event_date: eventDate,
          entry_time: entryTime,
          adults: numeroPersonas,
          children: 0,
          menu_text: menuText,
          offeringAssignments,
          allergens_and_diets: intolerancias || null,
          extras,
          setup_notes: setupNotes,
          second_course_type: null,
          room_id: roomId,
          override_capacity: false,
          notes: mesa || null,
          status: 'confirmed',
        }),
      });

      const createResult = (await resCreate.json()) as { groupEventId?: string; error?: string };

      if (!resCreate.ok || !createResult.groupEventId) {
        const message = createResult.error ?? 'No se ha podido crear la reserva. Inténtalo de nuevo.';
        console.error('[Nueva reserva] Error creando reserva', message);
        setSubmitError(message);
        setIsSubmitting(false);
        return;
      }

      const groupEventId = createResult.groupEventId;

      try {
        const resCalendar = await fetch('/api/calendar-sync', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ groupEventId }),
        });

        if (!resCalendar.ok) {
          console.error('[Nueva reserva] Error sincronizando con Google Calendar', resCalendar.statusText);
          setCalendarWarning(
            'La reserva se ha creado, pero ha habido un problema al sincronizar con Google Calendar. Revisa el calendario o inténtalo más tarde.',
          );
        }
      } catch (e) {
        console.error('[Nueva reserva] Error sincronizando con Google Calendar', e);
        setCalendarWarning(
          'La reserva se ha creado, pero ha habido un problema al sincronizar con Google Calendar. Revisa el calendario o inténtalo más tarde.',
        );
      }

      setSubmitSuccess('Reserva creada correctamente.');
      router.refresh();
    } catch (error) {
      console.error('[Nueva reserva] Error creando reserva', error);
      setSubmitError('No se ha podido crear la reserva. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reservas-new-pilot min-h-[calc(100dvh-4.5rem)] space-y-7 bg-[#12110f] px-4 py-5 text-[#efe8dc] md:px-6 lg:px-8">
      <ReservasNewPilotStyles />
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d6a76e]">Nueva reserva</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-normal text-[#f6f0e8]">Crear reserva</h1>
        <p className="text-sm text-slate-400">Introduce los datos básicos y asigna menús para cocina.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/reservas?view=week"
            className="inline-flex items-center justify-center rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-5 py-3 text-sm font-semibold text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] active:translate-y-px"
          >
            Cancelar
          </Link>
          <button type="submit" form="nueva-reserva-form" className="button-primary min-w-[12rem]" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar reserva'}
          </button>
        </div>
      </div>

      <form id="nueva-reserva-form" onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="card space-y-6 rounded-2xl p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#6f5434]/60 bg-[#3a2d20]/70 text-[#e0b77b]">
              <CalendarDaysIcon className="h-5 w-5 stroke-[1.7]" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-[#f6f0e8]">Detalles de la reserva</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="label">Fecha y hora</span>
              <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" required />
            </label>
            <label className="space-y-2">
              <span className="label">Turno</span>
              <div className="relative">
                <select value={turno} onChange={(e) => setTurno(e.target.value as Turno)} className="input appearance-none pr-10">
                  <option value="comida">Comida</option>
                  <option value="cena">Cena</option>
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
              </div>
            </label>
            <label className="space-y-2">
              <span className="label">Nombre del cliente</span>
              <input value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} className="input" required />
            </label>
            <label className="space-y-2">
              <span className="label">Teléfono</span>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input" placeholder="+34..." />
            </label>
            <label className="space-y-2">
              <span className="label">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </label>
            <label className="space-y-2">
              <span className="label">Número de personas</span>
              <input
                type="number"
                min={1}
                value={numeroPersonas}
                onChange={(e) => setNumeroPersonas(parseInt(e.target.value) || 1)}
                className="input"
              />
            </label>
            <label className="space-y-2">
              <span className="label">Sala</span>
              <div className="relative">
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="input appearance-none pr-10"
                  disabled={isLoadingRooms || rooms.length === 0}
                  required
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
              </div>
              {loadRoomsError && <p className="text-xs text-red-400">{loadRoomsError}</p>}
            </label>
            <label className="space-y-2">
              <span className="label">Mesa / zona</span>
              <input value={mesa} onChange={(e) => setMesa(e.target.value)} className="input" placeholder="Terraza 1, Interior 3..." />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="label">Intolerancias / alergias</span>
              <textarea
                value={intolerancias}
                onChange={(e) => setIntolerancias(e.target.value)}
                className="input min-h-[90px]"
                placeholder="Sin gluten, sin lácteos, vegano..."
              />
            </label>
            <label className="space-y-2">
              <span className="label">Notas sala</span>
              <textarea value={notasSala} onChange={(e) => setNotasSala(e.target.value)} className="input min-h-[90px]" placeholder="Preferencia de mesa, timings..." />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="label">Notas cocina</span>
              <textarea
                value={notasCocina}
                onChange={(e) => setNotasCocina(e.target.value)}
                className="input min-h-[90px]"
                placeholder="Cocciones, salsas aparte, alérgenos específicos..."
              />
            </label>
          </div>
        </div>

        <aside className="card max-h-none space-y-5 overflow-y-auto rounded-2xl p-5 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-7.5rem)]">
          <div className="space-y-2">
            <p className="label">Oferta asignada</p>
            <div className="relative">
              <select
                value={selectedOfferingId}
                onChange={(e) => {
                  setSelectedOfferingId(e.target.value);
                  resetMenuDependentState();
                }}
                className="input appearance-none pr-10"
                disabled={offeringsLoading || !!offeringsError || offerings.length === 0}
              >
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.display_name} {offering.kind === 'cheffing_card' ? '· Carta' : '· Menú'}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
            </div>
            {offeringsError && <p className="text-xs text-red-400">{offeringsError}</p>}
          </div>

          {offeringsLoading && <p className="text-sm text-slate-300">Cargando catálogo...</p>}

          {selectedOffering && !offeringsLoading && !offeringsError && (
            <div className="space-y-4">
              {isSelectedOfferingMenu && (
                <div>
                  <p className="text-sm font-semibold text-white">Segundos disponibles</p>
                  <p className="text-xs text-slate-400">Indica cantidades para cocina.</p>
                  <div className="mt-3 space-y-2">
                    {selectedOffering.segundos.map((segundo) => (
                    <div
                      key={segundo.id}
                      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{segundo.nombre}</p>
                          <p className="text-xs text-slate-400">{segundo.descripcion}</p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          className="input w-24"
                          value={segundosSeleccionados.find((s) => s.dishId === segundo.id)?.cantidad ?? 0}
                          onChange={(e) => handleSegundoChange(segundo, parseInt(e.target.value) || 0)}
                        />
                      </div>

                      {segundo.needsDonenessPoints && (
                        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                          <button
                            type="button"
                            onClick={() => setDonenessCollapsed((prev) => !prev)}
                            className="flex w-full items-center justify-between text-left text-xs uppercase tracking-wide text-slate-400"
                          >
                            <span>Puntos de cocción (opcional)</span>
                            <ChevronDownIcon
                              className={`h-4 w-4 transition-transform ${donenessCollapsed ? '' : 'rotate-180'}`}
                            />
                          </button>

                          {!donenessCollapsed && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-slate-400">
                                <span>Puntos de cocción (asigna personas)</span>
                                <span>
                                  {`${segundo.nombre}: ${
                                    segundosSeleccionados.find((s) => s.dishId === segundo.id)?.cantidad ?? 0
                                  } · Puntos: ${
                                    entrecotPoints.crudo +
                                    entrecotPoints.poco +
                                    entrecotPoints.alPunto +
                                    entrecotPoints.hecho +
                                    entrecotPoints.muyHecho
                                  }`}
                                </span>
                              </div>

                              {(
                                [
                                  { key: 'crudo', label: 'Crudo' },
                                  { key: 'poco', label: 'Poco hecho' },
                                  { key: 'alPunto', label: 'Al punto' },
                                  { key: 'hecho', label: 'Hecho' },
                                  { key: 'muyHecho', label: 'Muy hecho' },
                                ] as { key: keyof EntrecotPoints; label: string }[]
                              ).map((punto) => {
                                const currentValue = entrecotPoints[punto.key];
                                const maxEntrecotPeople = Math.max(
                                  segundosSeleccionados.find((s) => s.dishId === segundo.id)?.cantidad ?? 0,
                                  numeroPersonas,
                                  currentValue,
                                  10,
                                );
                                const options = Array.from({ length: maxEntrecotPeople + 1 }, (_, i) => i);

                                return (
                                  <div
                                    key={punto.key}
                                    className="flex flex-col gap-1 rounded-md border border-slate-800/60 bg-slate-950/40 px-3 py-2 md:flex-row md:items-center md:justify-between"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-white">{punto.label}</p>
                                      <p className="text-xs text-slate-400">Personas en este punto</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                                        onClick={() => updateEntrecotPoint(punto.key, currentValue - 1)}
                                        aria-label={`Restar ${punto.label}`}
                                      >
                                        -
                                      </button>

                                      <select
                                        className="input w-28 appearance-none pr-8 text-sm"
                                        value={currentValue}
                                        onChange={(e) => updateEntrecotPoint(punto.key, parseInt(e.target.value) || 0)}
                                      >
                                        {options.map((option) => (
                                          <option key={option} value={option}>
                                            {option} persona{option === 1 ? '' : 's'}
                                          </option>
                                        ))}
                                      </select>

                                      <button
                                        type="button"
                                        className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                                        onClick={() => updateEntrecotPoint(punto.key, Math.min(currentValue + 1, maxEntrecotPeople))}
                                        aria-label={`Sumar ${punto.label}`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    ))}
                  </div>
                </div>
              )}

              {isSelectedOfferingMenu && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">Menús personalizados e infantiles</p>
                  <div className="flex gap-2">
                    <button type="button" className="button-secondary" onClick={() => setIsCustomMenuModalOpen(true)}>
                      + Crear menú
                    </button>
                    <button type="button" className="button-secondary" onClick={() => setIsKidsMenuModalOpen(true)}>
                      + Menú infantil
                    </button>
                  </div>

                  <div className="space-y-3">
                    {customSeconds.map((custom) => (
                    <div
                      key={custom.id}
                      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                        <span>{custom.kind === 'custom_menu' ? 'Menú personalizado' : 'Menú infantil'}</span>
                        <button
                          type="button"
                          className="text-xs text-red-300 hover:text-red-200"
                          onClick={() => setCustomSeconds((prev) => prev.filter((c) => c.id !== custom.id))}
                        >
                          Eliminar
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-sm text-slate-200">
                          <span className="label text-xs">Nombre</span>
                          <input
                            className="input"
                            value={custom.name}
                            onChange={(e) => updateCustomSecond(custom.id, { name: e.target.value })}
                            placeholder="Ej: Vegano sin soja"
                          />
                        </label>
                        <div className="space-y-1 text-sm text-slate-200">
                          <span className="label text-xs">Cantidad</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                              onClick={() =>
                                updateCustomSecond(custom.id, {
                                  cantidad: Math.max(1, custom.cantidad - 1),
                                })
                              }
                              aria-label="Restar cantidad"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="input w-20 text-center"
                              value={custom.cantidad}
                              onChange={(e) =>
                                updateCustomSecond(custom.id, {
                                  cantidad: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                            />
                            <button
                              type="button"
                              className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                              onClick={() => updateCustomSecond(custom.id, { cantidad: custom.cantidad + 1 })}
                              aria-label="Sumar cantidad"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Notas (opcional)</span>
                        <input
                          className="input"
                          value={custom.notes ?? ''}
                          onChange={(e) => updateCustomSecond(custom.id, { notes: e.target.value })}
                          placeholder="Indicaciones específicas"
                        />
                      </label>
                    </div>
                    ))}
                  </div>
                </div>
              )}

              {isCustomMenuModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                  <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-6">
                    <div>
                      <p className="text-lg font-semibold text-white">Crear menú personalizado</p>
                      <p className="text-sm text-slate-400">Añade un nombre y cantidad para este menú.</p>
                    </div>
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleCreateCustomMenu();
                      }}
                    >
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Nombre</span>
                        <input
                          className="input"
                          value={customMenuName}
                          onChange={(e) => setCustomMenuName(e.target.value)}
                          placeholder="Ej: Menú vegano"
                          required
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Cantidad</span>
                        <input
                          type="number"
                          min={1}
                          className="input"
                          value={customMenuCantidad}
                          onChange={(e) => setCustomMenuCantidad(parseInt(e.target.value) || 1)}
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Notas (opcional)</span>
                        <input
                          className="input"
                          value={customMenuNotes}
                          onChange={(e) => setCustomMenuNotes(e.target.value)}
                          placeholder="Indicaciones específicas"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button type="button" className="button-secondary" onClick={handleCloseCustomMenuModal}>
                          Cancelar
                        </button>
                        <button type="submit" className="button-primary" disabled={!customMenuName.trim()}>
                          Crear menú
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {isKidsMenuModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                  <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-6">
                    <div>
                      <p className="text-lg font-semibold text-white">Crear menú infantil</p>
                      <p className="text-sm text-slate-400">Indica cantidad y notas para este menú.</p>
                    </div>
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleCreateKidsMenu();
                      }}
                    >
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Nombre (opcional)</span>
                        <input
                          className="input"
                          value={kidsMenuName}
                          onChange={(e) => setKidsMenuName(e.target.value)}
                          placeholder="Menú infantil"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Cantidad</span>
                        <input
                          type="number"
                          min={1}
                          className="input"
                          value={kidsMenuCantidad}
                          onChange={(e) => setKidsMenuCantidad(parseInt(e.target.value) || 1)}
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Notas (opcional)</span>
                        <input
                          className="input"
                          value={kidsMenuNotes}
                          onChange={(e) => setKidsMenuNotes(e.target.value)}
                          placeholder="Indicaciones específicas"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button type="button" className="button-secondary" onClick={handleCloseKidsMenuModal}>
                          Cancelar
                        </button>
                        <button type="submit" className="button-primary">
                          Crear menú
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 p-4 text-sm text-primary-100">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckIcon className="h-5 w-5" />
                  Resumen rápido
                </div>
                <p className="mt-2 text-primary-50">
                  {selectedOffering.kind === 'cheffing_card'
                    ? `${selectedOffering.display_name} · ${numeroPersonas} pax`
                    : segundosSeleccionados.length > 0
                      ? selectedOffering.segundos
                          .map((segundo) => {
                            const selected = segundosSeleccionados.find((entry) => entry.dishId === segundo.id);
                            if (!selected || selected.cantidad <= 0) return null;
                            return `${selected.cantidad}× ${segundo.nombre}`;
                          })
                          .filter((entry): entry is string => Boolean(entry))
                          .join(' · ')
                      : 'Añade cantidades para organizar la comanda.'}
                </p>
                {selectedOffering.kind === 'cheffing_menu' && (
                  <p className="mt-1 text-primary-50">Especiales/infantiles: {customMenusCount}</p>
                )}
              </div>

              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              {submitSuccess && <p className="text-sm text-green-400">{submitSuccess}</p>}
              {calendarWarning && <p className="text-sm text-amber-300">{calendarWarning}</p>}
              {warningMenus && <p className="text-sm text-amber-300">{warningMenus}</p>}
              {warningEntrecot && <p className="text-sm text-amber-300">{warningEntrecot}</p>}

              <button type="submit" className="button-primary w-full justify-center" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar reserva'}
              </button>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}
