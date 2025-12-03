'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { sampleMenus } from '@/data/sampleMenus';
import { EleccionSegundoPlato, Turno } from '@/types/reservation';
import { supabaseClient } from '@/lib/supabaseClient';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

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
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [loadRoomsError, setLoadRoomsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const menuSeleccionado = useMemo(() => sampleMenus.find((m) => m.id === menuId), [menuId]);

  const handleSegundoChange = (segundoId: string, nombre: string, cantidad: number) => {
    setSegundosSeleccionados((prev) => {
      const existing = prev.find((s) => s.segundoId === segundoId);
      if (existing) {
        return prev.map((s) => (s.segundoId === segundoId ? { ...s, cantidad } : s));
      }
      return [...prev, { segundoId, nombre, cantidad }];
    });
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
    let menuText: string | null = null;

    if (selectedMenu) {
      const segundosTexto = segundosSeleccionados
        .filter((s) => s.cantidad > 0)
        .map((s) => `- ${s.nombre}: ${s.cantidad}`)
        .join('\n');

      menuText = [
        `Menú: ${selectedMenu.nombre}`,
        segundosTexto ? 'Segundos:' : null,
        segundosTexto || null,
      ]
        .filter(Boolean)
        .join('\n');
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
      total_pax: numeroPersonas,
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
                    <div key={segundo.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
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
