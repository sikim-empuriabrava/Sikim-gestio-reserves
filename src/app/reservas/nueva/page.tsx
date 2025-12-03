'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { sampleMenus } from '@/data/sampleMenus';
import { EleccionSegundoPlato, Turno } from '@/types/reservation';
import { supabaseClient } from '@/lib/supabaseClient';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type EntrecotPoints = {
  muyPoco: number;
  poco: number;
  alPunto: number;
  hecho: number;
  muyHecho: number;
};

type CustomSecondType = 'especial' | 'infantil';

type CustomSecond = {
  id: string;
  tipo: CustomSecondType;
  nombre: string;
  cantidad: number;
  notas: string;
};

type RoomOption = {
  id: string;
  name: string;
};

export default function NuevaReservaPage() {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));
  const [turno, setTurno] = useState<Turno>('cena');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [numeroPersonas, setNumeroPersonas] = useState(2);
  const [menuId, setMenuId] = useState(sampleMenus[0]?.id ?? '');
  const [intolerancias, setIntolerancias] = useState('');
  const [notasSala, setNotasSala] = useState('');
  const [notasCocina, setNotasCocina] = useState('');
  const [mesa, setMesa] = useState('');
  const [segundosSeleccionados, setSegundosSeleccionados] = useState<EleccionSegundoPlato[]>([]);
  const [entrecotPoints, setEntrecotPoints] = useState<EntrecotPoints>({
    muyPoco: 0,
    poco: 0,
    alPunto: 0,
    hecho: 0,
    muyHecho: 0,
  });
  const [customSeconds, setCustomSeconds] = useState<CustomSecond[]>([]);
  const [warningMenus, setWarningMenus] = useState<string | null>(null);
  const [warningEntrecot, setWarningEntrecot] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [loadRoomsError, setLoadRoomsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const menuSeleccionado = useMemo(() => sampleMenus.find((m) => m.id === menuId), [menuId]);

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

  const handleAddCustomMenu = () => {
    setCustomSeconds((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        tipo: 'especial',
        nombre: '',
        cantidad: 1,
        notas: '',
      },
    ]);
  };

  const handleAddInfantilMenu = () => {
    setCustomSeconds((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        tipo: 'infantil',
        nombre: 'Menú infantil',
        cantidad: 1,
        notas: '',
      },
    ]);
  };

  useEffect(() => {
    const loadRooms = async () => {
      setIsLoadingRooms(true);
      setLoadRoomsError(null);
      const { data, error } = await supabaseClient
        .from('rooms')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('[Nueva reserva] Error cargando rooms', error);
        setLoadRoomsError('No se han podido cargar las salas.');
      } else {
        const options = (data ?? []).map((r) => ({ id: r.id, name: r.name }));
        setRooms(options);
        if (options.length > 0) {
          setRoomId((prev) => prev || options[0].id);
        }
      }

      setIsLoadingRooms(false);
    };

    loadRooms();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    if (!roomId) {
      setSubmitError('Selecciona una sala para continuar.');
      setIsSubmitting(false);
      return;
    }

    const [datePart, timePart] = fecha.split('T');
    const eventDate = datePart;
    const entryTime = timePart ? `${timePart}:00` : null;

    const selectedMenu = sampleMenus.find((m) => m.id === menuId);
    const totalSegundosBase = segundosSeleccionados.reduce((sum, s) => sum + s.cantidad, 0);
    const totalCustom = customSeconds.reduce((sum, s) => sum + s.cantidad, 0);
    const totalMenusAsignados = totalSegundosBase + totalCustom;

    const totalPuntosEntrecot =
      entrecotPoints.muyPoco +
      entrecotPoints.poco +
      entrecotPoints.alPunto +
      entrecotPoints.hecho +
      entrecotPoints.muyHecho;

    const entrecotSeleccionado = segundosSeleccionados.find((s) => s.segundoId === 'entrecot');
    const totalEntrecot = entrecotSeleccionado?.cantidad ?? 0;

    if (totalMenusAsignados !== numeroPersonas) {
      setWarningMenus(
        `Hay ${numeroPersonas} personas pero has asignado ${totalMenusAsignados} menús. Revisa si falta alguien o si sobra algún menú.`,
      );
    } else {
      setWarningMenus(null);
    }

    if (totalEntrecot > 0 && totalPuntosEntrecot !== totalEntrecot) {
      setWarningEntrecot(
        `Has pedido ${totalEntrecot} entrecots pero la suma de puntos de cocción es ${totalPuntosEntrecot}.`,
      );
    } else {
      setWarningEntrecot(null);
    }

    let menuText: string | null = null;

    if (selectedMenu) {
      const segundosBaseTexto = segundosSeleccionados
        .filter((s) => s.cantidad > 0)
        .map((s) => `- ${s.nombre}: ${s.cantidad}`)
        .join('\n');

      let detalleEntrecot: string | null = null;

      if (totalEntrecot > 0) {
        const partes: string[] = [];

        if (entrecotPoints.muyPoco > 0) partes.push(`Muy poco hecho: ${entrecotPoints.muyPoco}`);
        if (entrecotPoints.poco > 0) partes.push(`Poco hecho: ${entrecotPoints.poco}`);
        if (entrecotPoints.alPunto > 0) partes.push(`Al punto: ${entrecotPoints.alPunto}`);
        if (entrecotPoints.hecho > 0) partes.push(`Hecho: ${entrecotPoints.hecho}`);
        if (entrecotPoints.muyHecho > 0) partes.push(`Muy hecho: ${entrecotPoints.muyHecho}`);

        if (partes.length > 0) {
          detalleEntrecot = `Entrecot a la brasa (puntos):\n${partes.map((p) => `  · ${p}`).join('\n')}`;
        }
      }

      const especiales = customSeconds.filter((s) => s.tipo === 'especial');
      const infantiles = customSeconds.filter((s) => s.tipo === 'infantil');

      const especialesTexto =
        especiales.length > 0
          ? [
              'Segundos personalizados / menús especiales:',
              ...especiales.map(
                (s) =>
                  `- ${s.nombre || 'Menú especial'}: ${s.cantidad} pax${
                    s.notas ? ` (Notas: ${s.notas})` : ''
                  }`,
              ),
            ].join('\n')
          : null;

      const infantilesTexto =
        infantiles.length > 0
          ? [
              'Menús infantiles:',
              ...infantiles.map(
                (s) =>
                  `- ${s.nombre || 'Menú infantil'}: ${s.cantidad} pax${
                    s.notas ? ` (Notas: ${s.notas})` : ''
                  }`,
              ),
            ].join('\n')
          : null;

      const partesMenuText = [
        selectedMenu ? `Menú asignado: ${selectedMenu.nombre}` : null,
        segundosBaseTexto ? 'Segundos estándar:' : null,
        segundosBaseTexto || null,
        detalleEntrecot,
        especialesTexto,
        infantilesTexto,
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

    const groupEventInsert = {
      name: nombreCliente || 'Grupo sin nombre',
      event_date: eventDate,
      entry_time: entryTime,
      adults: numeroPersonas,
      children: 0,
      has_private_dining_room: false,
      has_private_party: false,
      second_course_type: null,
      menu_text: menuText,
      allergens_and_diets: intolerancias || null,
      extras,
      setup_notes: setupNotes,
      deposit_amount: null,
      deposit_status: null,
      invoice_data: null,
      status: 'confirmed' as const,
    };

    const { data: groupEventData, error: groupEventError } = await supabaseClient
      .from('group_events')
      .insert(groupEventInsert)
      .select('id')
      .single();

    if (groupEventError || !groupEventData) {
      console.error('[Nueva reserva] Error creando group_event', groupEventError);
      setSubmitError('No se ha podido crear la reserva. Inténtalo de nuevo.');
      setIsSubmitting(false);
      return;
    }

    const groupEventId = groupEventData.id;

    const allocationInsert = {
      group_event_id: groupEventId,
      room_id: roomId,
      adults: numeroPersonas,
      children: 0,
      override_capacity: false,
      notes: mesa || null,
    };

    const { error: allocationError } = await supabaseClient
      .from('group_room_allocations')
      .insert(allocationInsert);

    if (allocationError) {
      console.error('[Nueva reserva] Error creando group_room_allocation', allocationError);
      setSubmitError(
        'La reserva se ha creado, pero no se ha podido asignar a una sala. Revisa la configuración.',
      );
      setIsSubmitting(false);
      return;
    }

    setSubmitSuccess('Reserva creada correctamente.');
    setIsSubmitting(false);
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
              <select value={menuId} onChange={(e) => setMenuId(e.target.value)} className="input appearance-none pr-10">
                {sampleMenus.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.nombre}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
            </div>
          </div>

          {menuSeleccionado && (
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

                      {segundo.id === 'entrecot' && (
                        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-slate-400">
                            <span>Puntos de cocción (asigna personas)</span>
                            <span>
                              {`Entrecots: ${segundosSeleccionados.find((s) => s.segundoId === 'entrecot')?.cantidad ?? 0} · Puntos: ${
                                entrecotPoints.muyPoco +
                                entrecotPoints.poco +
                                entrecotPoints.alPunto +
                                entrecotPoints.hecho +
                                entrecotPoints.muyHecho
                              }`}
                            </span>
                          </div>

                          {(
                            [
                              { key: 'muyPoco', label: 'Muy poco hecho' },
                              { key: 'poco', label: 'Poco hecho' },
                              { key: 'alPunto', label: 'Al punto' },
                              { key: 'hecho', label: 'Hecho' },
                              { key: 'muyHecho', label: 'Muy hecho' },
                            ] as { key: keyof EntrecotPoints; label: string }[]
                          ).map((punto) => {
                            const currentValue = entrecotPoints[punto.key];
                            const maxEntrecotPeople = Math.max(
                              segundosSeleccionados.find((s) => s.segundoId === 'entrecot')?.cantidad ?? 0,
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
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Menús personalizados e infantiles</p>
                <div className="flex gap-2">
                  <button type="button" className="button-secondary" onClick={handleAddCustomMenu}>
                    + Crear menú personalizado
                  </button>
                  <button type="button" className="button-secondary" onClick={handleAddInfantilMenu}>
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
                        <span>
                          {custom.tipo === 'especial' ? 'Menú especial' : 'Menú infantil'}
                        </span>
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
                            value={custom.nombre}
                            onChange={(e) =>
                              setCustomSeconds((prev) =>
                                prev.map((c) =>
                                  c.id === custom.id ? { ...c, nombre: e.target.value } : c,
                                ),
                              )
                            }
                            placeholder="Ej: Vegano sin soja"
                          />
                        </label>
                        <label className="space-y-1 text-sm text-slate-200">
                          <span className="label text-xs">Cantidad</span>
                          <input
                            type="number"
                            min={0}
                            className="input"
                            value={custom.cantidad}
                            onChange={(e) =>
                              setCustomSeconds((prev) =>
                                prev.map((c) =>
                                  c.id === custom.id ? { ...c, cantidad: parseInt(e.target.value) || 0 } : c,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>

                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Notas</span>
                        <textarea
                          className="input"
                          value={custom.notas}
                          onChange={(e) =>
                            setCustomSeconds((prev) =>
                              prev.map((c) => (c.id === custom.id ? { ...c, notas: e.target.value } : c)),
                            )
                          }
                          placeholder="Indicaciones específicas"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

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
              </div>

              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              {submitSuccess && <p className="text-sm text-green-400">{submitSuccess}</p>}
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
