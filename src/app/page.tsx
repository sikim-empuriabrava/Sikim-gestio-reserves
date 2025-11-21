import { ArrowRightIcon, CalendarDaysIcon, ClockIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { sampleReservations } from '@/data/sampleReservations';
import { sampleMenus } from '@/data/sampleMenus';
import { Reserva } from '@/types/reservation';

const now = new Date();
const upcoming = sampleReservations
  .filter((res) => new Date(res.fecha) >= now)
  .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  .slice(0, 3);

const stats = [
  { label: 'Reservas activas', value: sampleReservations.filter((r) => r.estado !== 'cancelada').length },
  { label: 'Pendientes', value: sampleReservations.filter((r) => r.estado === 'pendiente').length },
  { label: 'Confirmadas', value: sampleReservations.filter((r) => r.estado === 'confirmada').length },
  { label: 'Capacidad hoy', value: `${sampleReservations.reduce((acc, r) => acc + r.numeroPersonas, 0)} pax` },
];

function formatDate(fecha: string) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fecha));
}

function ReservationCard({ reserva }: { reserva: Reserva }) {
  const menu = sampleMenus.find((m) => m.id === reserva.menuId);
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <CalendarDaysIcon className="h-5 w-5 text-primary-300" />
          <span>{formatDate(reserva.fecha)}</span>
          <span className="badge bg-slate-800 text-xs capitalize text-slate-200">{reserva.turno}</span>
        </div>
        <span
          className={`badge ${
            reserva.estado === 'confirmada'
              ? 'bg-green-500/20 text-green-200'
              : reserva.estado === 'pendiente'
                ? 'bg-amber-500/20 text-amber-200'
                : 'bg-rose-500/20 text-rose-200'
          }`}
        >
          {reserva.estado}
        </span>
      </div>
      <div>
        <p className="text-lg font-semibold text-white">{reserva.nombreCliente}</p>
        <p className="text-sm text-slate-400">Mesa {reserva.mesa ?? 'pendiente'} • {reserva.numeroPersonas} personas</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="badge bg-slate-800/80 text-slate-200">Menú: {menu?.nombre ?? 'Sin asignar'}</span>
        <span className="badge bg-slate-800/80 text-slate-200">Segundos: {reserva.segundosSeleccionados.length}</span>
        <span className="badge bg-slate-800/80 text-slate-200">Intolerancias: {reserva.intolerancias}</span>
      </div>
      <Link href={`/reservas`} className="button-ghost w-fit">
        Ver en listado
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card space-y-3 p-4">
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <div className="h-1.5 rounded-full bg-slate-800">
              <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-primary-500 to-accent" />
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-primary-200">Próximas reservas</p>
              <h2 className="section-title">Lo que llega en las próximas horas</h2>
            </div>
            <Link href="/reservas" className="button-ghost">
              Ver todo
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((res) => (
              <ReservationCard key={res.id} reserva={res} />
            ))}
            {upcoming.length === 0 && <p className="text-sm text-slate-400">No hay reservas próximas.</p>}
          </div>
        </div>

        <div className="card flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <SparklesIcon className="mt-1 h-6 w-6 text-accent" />
            <div>
              <p className="text-sm uppercase tracking-wide text-primary-200">Acciones rápidas</p>
              <h3 className="section-title">Atajos esenciales</h3>
              <p className="text-sm text-slate-400">Crea reservas o revisa notas internas al instante.</p>
            </div>
          </div>
          <div className="space-y-3">
            <Link href="/reservas/nueva" className="button-primary w-full justify-between">
              Nueva reserva
              <CalendarDaysIcon className="h-5 w-5" />
            </Link>
            <Link href="/reservas" className="button-ghost w-full justify-between">
              Agenda completa
              <ClockIcon className="h-5 w-5" />
            </Link>
          </div>
          <div className="rounded-lg bg-slate-900/60 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Notas de la noche</p>
            <ul className="mt-2 space-y-2 text-slate-400">
              <li>• Recordar alergias pendientes y mesas VIP.</li>
              <li>• Confirmar menús premium antes de las 19h.</li>
              <li>• Preparar bienvenida para grupo corporativo.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
