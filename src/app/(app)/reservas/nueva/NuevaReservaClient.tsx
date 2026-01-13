'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EleccionSegundoPlato, Turno } from '@/types/reservation';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type DbMenu = {
  id: string;
  code: string;
  display_name: string;
  price_eur: number;
};

type MenuWithSeconds = DbMenu & {
  segundos: {
    id: string;
    code: string;
    nombre: string;
    descripcion: string;
    needsDonenessPoints: boolean;
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

type RoomOption = {
  id: string;
  name: string;
};

export default function NuevaReservaClient() {
  const router = useRouter();
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));
  const [turno, setTurno] = useState<Turno>('cena');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [numeroPersonas, setNumeroPersonas] = useState(2);
  const [menuId, setMenuId] = useState('');
  const [intolerancias, setIntolerancias] = useState('');
  const [notasSala, setNotasSala] = useState('');
  const [notasCocina, setNotasCocina] = useState('');
  const [mesa, setMesa] = useState('');
  const [segundosSeleccionados, setSegundosSeleccionados] = useState<EleccionSegundoPlato[]>([]);
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
  const [menus, setMenus] = useState<MenuWithSeconds[]>([]);
  const [menusLoading, setMenusLoading] = useState(true);
  const [menusError, setMenusError] = useState<string | null>(null);
  const [donenessCollapsed, setDonenessCollapsed] = useState(true);

  const menuSeleccionado = useMemo(
    () => menus.find((m) => m.id === menuId) ?? null,
    [menus, menuId],
  );
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

  const handleSegundoChange = (segundoId: string, nombre: string, cantidad: number) => {
    setSegundosSeleccionados((prev) => {
      const existing = prev.find((s) => s.segundoId === segundoId);
      if (existing) {
        return prev.map((s) => (s.segundoId === segundoId ? { ...s, cantidad } : s));
      }
      return [...prev, { segundoId, nombre, cantidad }];
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

  const validateMenus = useCallback(() => {
    const totalSegundosBase = segundosSeleccionados.reduce((sum, s) => sum + s.cantidad, 0);
    const totalCustom = customSeconds.reduce((sum, s) => sum + s.cantidad, 0);
    const totalMenusAsignados = totalSegundosBase + totalCustom;

    const totalPuntosEntrecot =
      entrecotPoints.crudo +
      entrecotPoints.poco +
      entrecotPoints.alPunto +
      entrecotPoints.hecho +
      entrecotPoints.muyHecho;

    const donenessSecondsIds = menuSeleccionado
      ? menuSeleccionado.segundos.filter((s) => s.needsDonenessPoints).map((s) => s.id)
      : [];
    const donenessSelection = segundosSeleccionados.find((s) => donenessSecondsIds.includes(s.segundoId));
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
  }, [customSeconds, entrecotPoints, menuSeleccionado, numeroPersonas, segundosSeleccionados]);

  useEffect(() => {
    const loadMenus = async () => {
      setMenusLoading(true);
      setMenusError(null);
      let responseStatus: number | null = null;
      try {
        const response = await fetch('/api/menus', { cache: 'no-store' });

        responseStatus = response.status;
        if (!response.ok) {
          const body = await response.text();
          console.error('menus load failed', response.status, body);
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as { menus?: DbMenu[]; error?: string };
        const menusResponse = (data.menus ?? []).map((menu) => ({
          ...menu,
          segundos: [],
        }));

        if (menusResponse.length === 0) {
          throw new Error(data.error ?? 'No se han podido cargar los menús.');
        }

        setMenus(menusResponse);
        setMenuId((prev) => prev || menusResponse[0]?.id || '');
      } catch (error) {
        console.error('[Nueva reserva] Error cargando menús', error);
        setMenusError(
          `No se han podido cargar los menús.${responseStatus ? ` (status ${responseStatus})` : ''}`,
        );
      } finally {
        setMenusLoading(false);
      }
    };

    loadMenus();
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

    const selectedMenu = menuSeleccionado;

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

    const donenessSecondsIds = selectedMenu
      ? selectedMenu.segundos.filter((s) => s.needsDonenessPoints).map((s) => s.id)
      : [];
    const donenessSelection = segundosSeleccionados.find((s) => donenessSecondsIds.includes(s.segundoId));
    const totalDonenessPeople = donenessSelection?.cantidad ?? 0;

    let menuText: string | null = null;

    if (selectedMenu) {
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
        selectedMenu ? `Menú asignado: ${selectedMenu.display_name}` : null,
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-wide text-primary-200">Nueva reserva</p>
        <h1 className="section-title text-2xl">Crear reserva</h1>
        <p className="text-sm text-slate-400">Introduce los datos básicos y asigna menús para cocina.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-5 lg:col-span-2">
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

        <div className="card space-y-5 p-5">
          <div className="space-y-2">
            <p className="label">Menú asignado</p>
            <div className="relative">
              <select
                value={menuId}
                onChange={(e) => setMenuId(e.target.value)}
                className="input appearance-none pr-10"
                disabled={menusLoading || !!menusError || menus.length === 0}
              >
                {menus.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.display_name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
            </div>
            {menusError && <p className="text-xs text-red-400">{menusError}</p>}
          </div>

          {menusLoading && <p className="text-sm text-slate-300">Cargando menús...</p>}

          {menuSeleccionado && !menusLoading && !menusError && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-white">Segundos disponibles</p>
                <p className="text-xs text-slate-400">Indica cantidades para cocina.</p>
                <div className="mt-3 space-y-2">
                  {menuSeleccionado.segundos.map((segundo) => (
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
                          value={segundosSeleccionados.find((s) => s.segundoId === segundo.id)?.cantidad ?? 0}
                          onChange={(e) => handleSegundoChange(segundo.id, segundo.nombre, parseInt(e.target.value) || 0)}
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
                                    segundosSeleccionados.find((s) => s.segundoId === segundo.id)?.cantidad ?? 0
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
                                  segundosSeleccionados.find((s) => s.segundoId === segundo.id)?.cantidad ?? 0,
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
                  {segundosSeleccionados.length > 0
                    ? segundosSeleccionados
                        .filter((s) => s.cantidad > 0)
                        .map((s) => `${s.cantidad}× ${s.nombre}`)
                        .join(' · ')
                    : 'Añade cantidades para organizar la comanda.'}
                </p>
                <p className="mt-1 text-primary-50">Especiales/infantiles: {customMenusCount}</p>
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
        </div>
      </form>
    </div>
  );
}
