import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import {
  ArrowRightIcon,
  AtSymbolIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { MetricCard, MetricStrip } from '@/components/ui/MetricCard';
import { DataTableShell } from '@/components/ui/DataTableShell';
import { getCrmListData, type CrmCustomerListItem, type CrmReservation } from '@/lib/crm/queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type SearchParams = {
  q?: string;
};

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '-';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(
    new Date(dateString),
  );
}

function formatReservationSummary(reservation: CrmReservation | null) {
  if (!reservation) return '-';
  const time = reservation.entry_time ? ` ${reservation.entry_time.slice(0, 5)}` : '';
  return `${formatDate(reservation.event_date)}${time}`;
}

function formatReservationsPerCustomer(linkedReservations: number, totalCustomers: number) {
  const ratio = totalCustomers > 0 ? linkedReservations / totalCustomers : 0;

  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio);
}

function ContactValue({
  icon,
  value,
  empty,
}: {
  icon: React.ReactNode;
  value: string | null | undefined;
  empty: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-slate-300">
      <span className="shrink-0 text-slate-500">{icon}</span>
      <span className="truncate">{value || empty}</span>
    </span>
  );
}

function CustomerMobileCard({ item }: { item: CrmCustomerListItem }) {
  return (
    <article className="rounded-2xl border border-slate-800/75 bg-slate-950/70 p-4 shadow-[0_18px_42px_-34px_rgba(2,6,23,0.95)] md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-white">{item.customer.display_name}</h2>
          <div className="mt-2 space-y-1">
            <ContactValue
              icon={<PhoneIcon className="h-4 w-4" aria-hidden="true" />}
              value={item.primaryPhone?.contact_value}
              empty="Sin telefono"
            />
            <ContactValue
              icon={<AtSymbolIcon className="h-4 w-4" aria-hidden="true" />}
              value={item.primaryEmail?.contact_value}
              empty="Sin email"
            />
          </div>
        </div>
        <Link
          href={`/crm/clientes/${item.customer.id}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary-400/30 bg-primary-500/10 text-primary-100 transition hover:bg-primary-500/20 focus:outline-none focus:ring-2 focus:ring-primary-400/60"
          aria-label={`Ver cliente ${item.customer.display_name}`}
        >
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <dt className="text-xs text-slate-500">Reservas</dt>
          <dd className="mt-1 font-semibold text-white">{item.reservationCount}</dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <dt className="text-xs text-slate-500">Pax</dt>
          <dd className="mt-1 font-semibold text-white">{item.totalPax}</dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <dt className="text-xs text-slate-500">Ultima</dt>
          <dd className="mt-1 font-semibold text-white">{formatReservationSummary(item.lastReservation)}</dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <dt className="text-xs text-slate-500">Proxima</dt>
          <dd className="mt-1 font-semibold text-white">{formatReservationSummary(item.nextReservation)}</dd>
        </div>
      </dl>
    </article>
  );
}

export default async function CrmPage({ searchParams }: { searchParams?: SearchParams }) {
  noStore();

  const rawQuery = searchParams?.q?.trim() ?? '';
  const { metrics, items } = await getCrmListData(rawQuery);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/75 bg-slate-950/70 p-5 shadow-lg shadow-slate-950/25 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-200">CRM</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Clientes</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Contactos centralizados desde reservas, con busqueda por nombre, email y telefono.
          </p>
        </div>
        <form action="/crm" className="flex w-full flex-col gap-2 sm:flex-row md:max-w-lg" role="search">
          <label htmlFor="crm-search" className="sr-only">
            Buscar clientes
          </label>
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="crm-search"
              name="q"
              defaultValue={rawQuery}
              placeholder="Nombre, email o telefono"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-9 text-sm text-white shadow-inner shadow-slate-950/40 outline-none transition placeholder:text-slate-600 focus:border-primary-400/70 focus:ring-2 focus:ring-primary-400/30"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-lg shadow-primary-950/25 transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400/60"
          >
            Buscar
          </button>
        </form>
      </div>

      <MetricStrip className="xl:grid-cols-5">
        <MetricCard
          label="Clientes"
          value={metrics.totalCustomers}
          description="Total CRM"
          icon={<UsersIcon className="h-5 w-5" />}
          tone="sky"
        />
        <MetricCard
          label="Con reservas"
          value={metrics.customersWithReservations}
          description="Clientes vinculados"
          icon={<UserGroupIcon className="h-5 w-5" />}
          tone="emerald"
        />
        <MetricCard
          label="Reservas vinculadas"
          value={metrics.linkedReservations}
          description="group_events.customer_id"
          icon={<ArrowRightIcon className="h-5 w-5" />}
          tone="violet"
        />
        <MetricCard
          label="Reservas por cliente"
          value={formatReservationsPerCustomer(metrics.linkedReservations, metrics.totalCustomers)}
          description="Media histórica"
          icon={<ChartBarIcon className="h-5 w-5" />}
          tone="slate"
        />
        <MetricCard
          label="Sin telefono o email"
          value={metrics.customersMissingPhoneOrEmail}
          description="Dato incompleto"
          icon={<AtSymbolIcon className="h-5 w-5" />}
          tone="amber"
        />
      </MetricStrip>

      <div className="space-y-3 md:hidden">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
            No hay clientes que coincidan con la busqueda.
          </div>
        ) : (
          items.map((item) => <CustomerMobileCard key={item.customer.id} item={item} />)
        )}
      </div>

      <DataTableShell
        className="hidden md:block"
        title="Listado de clientes"
        description={rawQuery ? `${items.length} resultados para "${rawQuery}"` : `${items.length} clientes visibles`}
      >
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Telefono</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold text-right">Reservas</th>
              <th className="px-4 py-3 font-semibold text-right">Pax</th>
              <th className="px-4 py-3 font-semibold">Ultima</th>
              <th className="px-4 py-3 font-semibold">Proxima</th>
              <th className="px-4 py-3 font-semibold text-right">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No hay clientes que coincidan con la busqueda.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.customer.id} className="bg-slate-950/35 transition hover:bg-slate-900/55">
                  <td className="max-w-[16rem] px-4 py-3">
                    <Link
                      href={`/crm/clientes/${item.customer.id}`}
                      className="font-semibold text-white hover:text-primary-200"
                    >
                      {item.customer.display_name}
                    </Link>
                  </td>
                  <td className="max-w-[12rem] px-4 py-3 text-slate-300">
                    <span className="block truncate">{item.primaryPhone?.contact_value ?? '-'}</span>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-slate-300">
                    <span className="block truncate">{item.primaryEmail?.contact_value ?? '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                    {item.reservationCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{item.totalPax}</td>
                  <td className="px-4 py-3 text-slate-300">{formatReservationSummary(item.lastReservation)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatReservationSummary(item.nextReservation)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/crm/clientes/${item.customer.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-primary-400/60 hover:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-400/60"
                    >
                      Ver cliente
                      <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
