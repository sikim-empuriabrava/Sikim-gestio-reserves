'use client';

import { useMemo, useState } from 'react';
import { CalendarDaysIcon, FunnelIcon, MagnifyingGlassIcon, PhoneIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { sampleReservations } from '@/data/sampleReservations';
import { sampleMenus } from '@/data/sampleMenus';
import { EstadoReserva } from '@/types/reservation';

const estados: EstadoReserva[] = ['pendiente', 'confirmada', 'cancelada'];

function formatDate(fecha: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fecha));
}

function statusBadgeClass(estado: EstadoReserva) {
  switch (estado) {
    case 'confirmada':
      return 'bg-green-500/15 text-green-200';
    case 'pendiente':
      return 'bg-amber-500/15 text-amber-200';
    default:
      return 'bg-rose-500/15 text-rose-200';
  }
}

export default function ReservasPage() {
  const [selectedEstado, setSelectedEstado] = useState<EstadoReserva | 'todas'>('todas');
  const [turno, setTurno] = useState<'todos' | 'comida' | 'cena'>('todos');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return sampleReservations.filter((reserva) => {
      const estadoOK = selectedEstado === 'todas' || reserva.estado === selectedEstado;
      const turnoOK = turno === 'todos' || reserva.turno === turno;
      const textMatch = `${reserva.nombreCliente} ${reserva.intolerancias} ${reserva.mesa ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return estadoOK && turnoOK && textMatch;
    });
  }, [selectedEstado, turno, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm uppercase tracking-wide text-primary-200">Agenda</p>
          <h1 className="section-title text-2xl">Reservas</h1>
          <p className="text-sm text-slate-400">Filtra por estado, turno o busca por cliente.</p>
        </div>
        <Link href="/reservas/nueva" className="button-primary">
          Crear reserva
          <CalendarDaysIcon className="h-5 w-5" />
        </Link>
      </div>

      <div className="card flex flex-wrap items-center gap-4 p-4 text-sm text-slate-300">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedEstado('todas')}
            className={`badge ${selectedEstado === 'todas' ? 'bg-primary-600/50 text-white' : 'bg-slate-800 text-slate-200'}`}
          >
            Todas
          </button>
          {estados.map((estado) => (
            <button
              key={estado}
              type="button"
              onClick={() => setSelectedEstado(estado)}
              className={`badge ${selectedEstado === estado ? statusBadgeClass(estado) : 'bg-slate-800 text-slate-200'}`}
            >
              {estado}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-slate-500" />
          <select
            value={turno}
            onChange={(e) => setTurno(e.target.value as typeof turno)}
            className="input w-40"
          >
            <option value="todos">Todos los turnos</option>
            <option value="comida">Comida</option>
            <option value="cena">Cena</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon className="h-5 w-5 text-slate-500" />
          <input
            type="search"
            placeholder="Buscar por nombre, mesa o alergias"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-72"
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Turno</th>
              <th>Personas</th>
              <th>Menú</th>
              <th>Intolerancias</th>
              <th>Estado</th>
              <th>Contacto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((reserva) => {
              const menu = sampleMenus.find((m) => m.id === reserva.menuId);
              return (
                <tr key={reserva.id}>
                  <td className="font-semibold text-white">{reserva.nombreCliente}</td>
                  <td>{formatDate(reserva.fecha)}</td>
                  <td className="capitalize">{reserva.turno}</td>
                  <td className="text-center font-semibold text-slate-100">{reserva.numeroPersonas}</td>
                  <td>{menu?.nombre ?? '—'}</td>
                  <td className="max-w-xs truncate text-slate-400">{reserva.intolerancias}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(reserva.estado)}`}>{reserva.estado}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      {reserva.telefono && (
                        <span className="inline-flex items-center gap-1">
                          <PhoneIcon className="h-4 w-4" />
                          {reserva.telefono}
                        </span>
                      )}
                      {reserva.email && <span className="text-primary-200">{reserva.email}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500">
                  No hay reservas con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
