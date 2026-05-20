import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  AtSymbolIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  PhoneIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { MetricCard, MetricStrip } from '@/components/ui/MetricCard';
import { DataTableShell } from '@/components/ui/DataTableShell';
import { requireCrmReadAccess } from '@/lib/crm/access';
import { getCustomerDetailData, type CrmContact, type CrmReservation } from '@/lib/crm/queries';
import {
  addCustomerContact,
  deleteCustomerContact,
  markCustomerContactPrimary,
  updateCustomerDetails,
} from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '-';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(dateString),
  );
}

function formatReservationDate(reservation: CrmReservation | null) {
  if (!reservation) return '-';
  const time = reservation.entry_time ? ` ${reservation.entry_time.slice(0, 5)}` : '';
  return `${formatDate(reservation.event_date)}${time}`;
}

function eventModeLabel(mode: string | null) {
  switch (mode) {
    case 'dinner_private_party':
      return 'Cena + fiesta';
    case 'private_party_only':
      return 'Solo fiesta';
    case 'dinner':
      return 'Cena';
    default:
      return mode ?? '-';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'confirmed':
      return 'Confirmada';
    case 'draft':
      return 'Borrador';
    case 'pending':
      return 'Pendiente';
    case 'completed':
      return 'Completada';
    case 'cancelled':
      return 'Cancelada';
    case 'no_show':
      return 'No-show';
    default:
      return status;
  }
}

function ContactList({
  title,
  icon,
  contacts,
  type,
  customerId,
  canWrite,
}: {
  title: string;
  icon: React.ReactNode;
  contacts: CrmContact[];
  type: 'phone' | 'email';
  customerId: string;
  canWrite: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-800/75 bg-slate-950/70 p-4">
      <div className="flex items-center gap-2">
        <span className="text-primary-200">{icon}</span>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="mt-3 space-y-2">
        {contacts.length === 0 ? (
          <p className="text-sm text-slate-500">Sin datos.</p>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/55 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{contact.contact_value}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{contact.normalized_value}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {contact.is_primary ? (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                    Principal
                  </span>
                ) : canWrite ? (
                  <form action={markCustomerContactPrimary}>
                    <input type="hidden" name="customer_id" value={customerId} />
                    <input type="hidden" name="contact_id" value={contact.id} />
                    <input type="hidden" name="contact_type" value={type} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-primary-400/60 hover:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                    >
                      Principal
                    </button>
                  </form>
                ) : null}
                {canWrite ? (
                  <form action={deleteCustomerContact}>
                    <input type="hidden" name="customer_id" value={customerId} />
                    <input type="hidden" name="contact_id" value={contact.id} />
                    <input type="hidden" name="contact_type" value={type} />
                    <button
                      type="submit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
                      aria-label={`Eliminar ${contact.contact_value}`}
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function HistoricalValues({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length === 0 ? (
          <span className="text-sm text-slate-500">Sin datos historicos</span>
        ) : (
          values.map((value) => (
            <span
              key={value}
              className="max-w-full truncate rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-200"
            >
              {value}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  noStore();

  const access = await requireCrmReadAccess(`/crm/clientes/${params.id}`);
  const data = await getCustomerDetailData(params.id);

  if (!data) {
    notFound();
  }

  const phoneContacts = data.contacts.filter((contact) => contact.contact_type === 'phone');
  const emailContacts = data.contacts.filter((contact) => contact.contact_type === 'email');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/75 bg-slate-950/70 p-5 shadow-lg shadow-slate-950/25 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Link
            href="/crm"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-200 transition hover:text-primary-100"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Volver al CRM
          </Link>
          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary-400/30 bg-primary-500/10 text-primary-100">
              <UserIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold text-white">{data.customer.display_name}</h1>
              <p className="mt-1 text-sm text-slate-400">Cliente creado desde {data.customer.source ?? 'CRM'}.</p>
            </div>
          </div>
        </div>
        {access.canWrite ? (
          <span className="w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            Edicion admin
          </span>
        ) : (
          <span className="w-fit rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
            Solo lectura
          </span>
        )}
      </div>

      <MetricStrip>
        <MetricCard
          label="Reservas"
          value={data.item.reservationCount}
          description="Historial vinculado"
          icon={<CalendarDaysIcon className="h-5 w-5" />}
          tone="sky"
        />
        <MetricCard
          label="Pax acumulados"
          value={data.item.totalPax}
          description="Suma historica"
          icon={<UsersIcon className="h-5 w-5" />}
          tone="emerald"
        />
        <MetricCard
          label="Ultima reserva"
          value={formatReservationDate(data.item.lastReservation)}
          description={data.item.lastReservation?.name ?? 'Sin datos'}
          icon={<CheckCircleIcon className="h-5 w-5" />}
          tone="violet"
        />
        <MetricCard
          label="Proxima reserva"
          value={formatReservationDate(data.item.nextReservation)}
          description={data.item.nextReservation?.name ?? 'Sin datos'}
          icon={<CalendarDaysIcon className="h-5 w-5" />}
          tone="amber"
        />
      </MetricStrip>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
        <section className="rounded-2xl border border-slate-800/75 bg-slate-950/70 p-4">
          <h2 className="text-base font-semibold text-white">Datos del cliente</h2>
          {access.canWrite ? (
            <form action={updateCustomerDetails} className="mt-4 space-y-4">
              <input type="hidden" name="customer_id" value={data.customer.id} />
              <div>
                <label htmlFor="display_name" className="text-sm font-semibold text-slate-200">
                  Nombre visible
                </label>
                <input
                  id="display_name"
                  name="display_name"
                  defaultValue={data.customer.display_name}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-primary-400/70 focus:ring-2 focus:ring-primary-400/30"
                  required
                />
              </div>
              <div>
                <label htmlFor="notes" className="text-sm font-semibold text-slate-200">
                  Notas
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  defaultValue={data.customer.notes ?? ''}
                  rows={5}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-primary-400/70 focus:ring-2 focus:ring-primary-400/30"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-lg shadow-primary-950/25 transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400/60"
              >
                Guardar cambios
              </button>
            </form>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm leading-6 text-slate-300">
              {data.customer.notes || 'Sin notas internas.'}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800/75 bg-slate-950/70 p-4">
          <h2 className="text-base font-semibold text-white">Añadir contacto</h2>
          {access.canWrite ? (
            <form action={addCustomerContact} className="mt-4 grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <input type="hidden" name="customer_id" value={data.customer.id} />
              <label className="sr-only" htmlFor="contact_type">
                Tipo
              </label>
              <select
                id="contact_type"
                name="contact_type"
                className="h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-primary-400/70 focus:ring-2 focus:ring-primary-400/30"
              >
                <option value="phone">Telefono</option>
                <option value="email">Email</option>
              </select>
              <label className="sr-only" htmlFor="contact_value">
                Valor
              </label>
              <input
                id="contact_value"
                name="contact_value"
                placeholder="600 000 000"
                className="h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-primary-400/70 focus:ring-2 focus:ring-primary-400/30"
                required
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary-400/30 bg-primary-500/10 px-4 text-sm font-semibold text-primary-100 transition hover:bg-primary-500/20 focus:outline-none focus:ring-2 focus:ring-primary-400/60 sm:col-span-2"
              >
                Añadir contacto
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Solo admin puede editar contactos.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ContactList
          title="Telefonos"
          icon={<PhoneIcon className="h-5 w-5" aria-hidden="true" />}
          contacts={phoneContacts}
          type="phone"
          customerId={data.customer.id}
          canWrite={access.canWrite}
        />
        <ContactList
          title="Emails"
          icon={<AtSymbolIcon className="h-5 w-5" aria-hidden="true" />}
          contacts={emailContacts}
          type="email"
          customerId={data.customer.id}
          canWrite={access.canWrite}
        />
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-800/75 bg-slate-950/70 p-4">
        <h2 className="text-base font-semibold text-white">Datos usados en reservas asociadas</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <HistoricalValues label="Nombres historicos" values={data.historicalNames} />
          <HistoricalValues label="Telefonos historicos" values={data.historicalPhones} />
          <HistoricalValues label="Emails historicos" values={data.historicalEmails} />
        </div>
      </section>

      <DataTableShell title="Historial de reservas" description={`${data.reservations.length} reservas vinculadas`}>
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Reserva</th>
              <th className="px-4 py-3 font-semibold text-right">Pax</th>
              <th className="px-4 py-3 font-semibold">Modalidad</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {data.reservations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No hay reservas asociadas a este cliente.
                </td>
              </tr>
            ) : (
              data.reservations.map((reservation) => (
                <tr key={reservation.id} className="bg-slate-950/35 transition hover:bg-slate-900/55">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                    {formatReservationDate(reservation)}
                  </td>
                  <td className="max-w-[20rem] px-4 py-3">
                    <Link
                      href={`/reservas/grupo/${reservation.id}`}
                      className="font-semibold text-white hover:text-primary-200"
                    >
                      {reservation.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                    {reservation.total_pax ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{eventModeLabel(reservation.event_mode)}</td>
                  <td className="px-4 py-3 text-slate-300">{statusLabel(reservation.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/reservas/grupo/${reservation.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-primary-400/60 hover:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-400/60"
                    >
                      Abrir
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
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
