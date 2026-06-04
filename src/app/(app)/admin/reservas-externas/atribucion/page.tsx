import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  MegaphoneIcon,
  NoSymbolIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import {
  OperationalMetricCard,
  OperationalPageHeader,
  OperationalPanel,
  OperationalPill,
  operationalSecondaryButtonClass,
} from '@/components/operational/OperationalUI';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 1000;
const DIRECT_UNKNOWN_LABEL = 'Direct / Unknown';
const NO_LANGUAGE_LABEL = 'No detectado';
const CONFIRMED_STATUSES = new Set(['confirmed', 'completed']);
const CANCELLED_STATUSES = new Set(['cancelled', 'no_show']);

type RangeKey = '7d' | '30d' | 'month' | 'all';

type SearchParams = {
  range?: string | string[];
};

type GroupEventAttributionRow = {
  id: string;
  name: string | null;
  event_date: string | null;
  entry_time: string | null;
  status: string | null;
  total_pax: number | null;
  created_at: string | null;
};

type ExternalSubmissionJoinedRow = {
  id: string;
  group_event_id: string;
  source_label: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page: string | null;
  fbclid: string | null;
  gclid: string | null;
  ttclid: string | null;
  preferred_language: string | null;
  submitted_at: string | null;
  group_events: GroupEventAttributionRow | GroupEventAttributionRow[] | null;
};

type AttributionRow = Omit<ExternalSubmissionJoinedRow, 'group_events'> & {
  group_event: GroupEventAttributionRow;
};

type RankingRow = {
  label: string;
  requests: number;
  pax: number;
  confirmed: number;
  pending: number;
};

type CampaignRankingRow = RankingRow & {
  source: string;
  medium: string;
};

const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'month', label: 'Mes actual' },
  { key: 'all', label: 'Todo' },
];

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseRange(value: string | string[] | undefined): RangeKey {
  const key = getFirstParam(value);
  return key === '7d' || key === '30d' || key === 'month' || key === 'all' ? key : '30d';
}

function getRangeFilter(range: RangeKey, now = new Date()) {
  if (range === 'all') {
    return {
      startIso: null,
      label: 'Todo el historico',
      metricDescription: 'Historico completo',
    };
  }

  if (range === 'month') {
    const start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    return {
      startIso: start.toISOString(),
      label: new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now),
      metricDescription: 'Desde el inicio del mes',
    };
  }

  const days = range === '7d' ? 7 : 30;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    startIso: start.toISOString(),
    label: `Ultimos ${days} dias`,
    metricDescription: `Desde hace ${days} dias`,
  };
}

function getGroupEvent(row: ExternalSubmissionJoinedRow) {
  if (Array.isArray(row.group_events)) {
    return row.group_events[0] ?? null;
  }

  return row.group_events;
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeSourceLabel(value: string | null | undefined) {
  return cleanText(value) ?? DIRECT_UNKNOWN_LABEL;
}

function normalizeLanguage(value: string | null | undefined) {
  return cleanText(value)?.toUpperCase() ?? NO_LANGUAGE_LABEL;
}

function getPax(row: AttributionRow) {
  return typeof row.group_event.total_pax === 'number' ? row.group_event.total_pax : 0;
}

function isPending(row: AttributionRow) {
  return row.group_event.status === 'pending';
}

function isConfirmed(row: AttributionRow) {
  return row.group_event.status ? CONFIRMED_STATUSES.has(row.group_event.status) : false;
}

function isCancelled(row: AttributionRow) {
  return row.group_event.status ? CANCELLED_STATUSES.has(row.group_event.status) : false;
}

function sortRankings<T extends RankingRow>(rows: T[]) {
  return rows.sort((a, b) => b.requests - a.requests || b.pax - a.pax || a.label.localeCompare(b.label));
}

function buildSourceRanking(rows: AttributionRow[]) {
  const map = new Map<string, RankingRow>();

  rows.forEach((row) => {
    const label = normalizeSourceLabel(row.source_label);
    const current = map.get(label) ?? { label, requests: 0, pax: 0, confirmed: 0, pending: 0 };

    current.requests += 1;
    current.pax += getPax(row);
    current.confirmed += isConfirmed(row) ? 1 : 0;
    current.pending += isPending(row) ? 1 : 0;
    map.set(label, current);
  });

  return sortRankings(Array.from(map.values()));
}

function buildCampaignRanking(rows: AttributionRow[]) {
  const map = new Map<string, CampaignRankingRow>();

  rows.forEach((row) => {
    const campaign = cleanText(row.utm_campaign);
    if (!campaign) return;

    const source = cleanText(row.utm_source) ?? '-';
    const medium = cleanText(row.utm_medium) ?? '-';
    const key = `${source}\u0000${medium}\u0000${campaign}`;
    const current =
      map.get(key) ?? { label: campaign, source, medium, requests: 0, pax: 0, confirmed: 0, pending: 0 };

    current.requests += 1;
    current.pax += getPax(row);
    current.confirmed += isConfirmed(row) ? 1 : 0;
    current.pending += isPending(row) ? 1 : 0;
    map.set(key, current);
  });

  return sortRankings(Array.from(map.values()));
}

function buildLanguageRanking(rows: AttributionRow[]) {
  const map = new Map<string, RankingRow>();

  rows.forEach((row) => {
    const label = normalizeLanguage(row.preferred_language);
    const current = map.get(label) ?? { label, requests: 0, pax: 0, confirmed: 0, pending: 0 };

    current.requests += 1;
    current.pax += getPax(row);
    current.confirmed += isConfirmed(row) ? 1 : 0;
    current.pending += isPending(row) ? 1 : 0;
    map.set(label, current);
  });

  return sortRankings(Array.from(map.values()));
}

function formatDateTime(value: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value: string | null) {
  if (!value) return '-';

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date);
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : '-';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES').format(value);
}

function getStatusLabel(status: string | null) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No show',
  };

  return status ? labels[status] ?? status : 'Sin estado';
}

function getStatusTone(status: string | null): 'neutral' | 'success' | 'warning' | 'danger' | 'muted' {
  if (status === 'pending') return 'warning';
  if (status && CONFIRMED_STATUSES.has(status)) return 'success';
  if (status && CANCELLED_STATUSES.has(status)) return 'danger';
  return 'muted';
}

async function fetchAttributionRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  startIso: string | null,
) {
  const rows: AttributionRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('external_reservation_submissions')
      .select(
        'id, group_event_id, source_label, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_page, fbclid, gclid, ttclid, preferred_language, submitted_at, group_events!inner(id, name, event_date, entry_time, status, total_pax, created_at)',
      );

    if (startIso) {
      query = query.gte('submitted_at', startIso);
    }

    const { data, error } = await query
      .order('submitted_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const batch = ((data ?? []) as ExternalSubmissionJoinedRow[]).flatMap((row) => {
      const groupEvent = getGroupEvent(row);
      if (!groupEvent) return [];

      return [
        {
          id: row.id,
          group_event_id: row.group_event_id,
          source_label: row.source_label,
          utm_source: row.utm_source,
          utm_medium: row.utm_medium,
          utm_campaign: row.utm_campaign,
          utm_content: row.utm_content,
          utm_term: row.utm_term,
          referrer: row.referrer,
          landing_page: row.landing_page,
          fbclid: row.fbclid,
          gclid: row.gclid,
          ttclid: row.ttclid,
          preferred_language: row.preferred_language,
          submitted_at: row.submitted_at,
          group_event: groupEvent,
        },
      ];
    });

    rows.push(...batch);

    if (!data || data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

function MetricGrid({ rows, rangeDescription }: { rows: AttributionRow[]; rangeDescription: string }) {
  const totalRequests = rows.length;
  const pending = rows.filter(isPending).length;
  const confirmed = rows.filter(isConfirmed).length;
  const cancelled = rows.filter(isCancelled).length;
  const pax = rows.reduce((sum, row) => sum + getPax(row), 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <OperationalMetricCard
        icon={ChartBarIcon}
        label="Solicitudes externas"
        value={formatNumber(totalRequests)}
        description={rangeDescription}
      />
      <OperationalMetricCard
        icon={ClockIcon}
        label="Pendientes"
        value={formatNumber(pending)}
        description="status = pending"
      />
      <OperationalMetricCard
        icon={CheckCircleIcon}
        label="Confirmadas"
        value={formatNumber(confirmed)}
        description="confirmed + completed"
      />
      <OperationalMetricCard
        icon={NoSymbolIcon}
        label="Canceladas / no show"
        value={formatNumber(cancelled)}
        description="cancelled + no_show"
      />
      <OperationalMetricCard
        icon={UsersIcon}
        label="Pax generados"
        value={formatNumber(pax)}
        description="Suma de total_pax"
      />
    </div>
  );
}

function RangeSelector({ currentRange }: { currentRange: RangeKey }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Rango temporal">
      {rangeOptions.map((option) => {
        const active = option.key === currentRange;

        return (
          <Link
            key={option.key}
            href={`/admin/reservas-externas/atribucion?range=${option.key}`}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/35 ${
              active
                ? 'border-[#d6a76e]/65 bg-[#7d5932]/35 text-[#f1c98f]'
                : 'border-[#4a3f32]/80 bg-[#151412]/80 text-[#d8cfc2] hover:border-[#8b6a43]/75 hover:text-[#ffe2b6]'
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function RankingTable({
  title,
  description,
  rows,
  emptyLabel,
  showCampaignFields = false,
}: {
  title: string;
  description: string;
  rows: Array<RankingRow | CampaignRankingRow>;
  emptyLabel: string;
  showCampaignFields?: boolean;
}) {
  return (
    <OperationalPanel className="overflow-hidden">
      <div className="border-b border-[#3c342a]/70 p-5">
        <h2 className="text-lg font-semibold text-[#f6f0e8]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#a99d90]">{description}</p>
      </div>
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#3c342a]/70 text-sm">
            <thead className="bg-[#12110f]/70 text-xs uppercase tracking-wide text-[#a99d90]">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  {showCampaignFields ? 'Campaña' : 'Valor'}
                </th>
                {showCampaignFields ? (
                  <>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Source
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Medium
                    </th>
                  </>
                ) : null}
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Solicitudes
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Pax
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Confirmadas
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Pendientes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3c342a]/70">
              {rows.map((row) => {
                const campaignRow = row as CampaignRankingRow;

                return (
                  <tr key={showCampaignFields ? `${campaignRow.source}-${campaignRow.medium}-${row.label}` : row.label}>
                    <td className="max-w-[18rem] px-4 py-3 font-medium text-[#f6f0e8]">
                      <span className="line-clamp-2">{row.label}</span>
                    </td>
                    {showCampaignFields ? (
                      <>
                        <td className="px-4 py-3 text-[#d8cfc2]">{campaignRow.source}</td>
                        <td className="px-4 py-3 text-[#d8cfc2]">{campaignRow.medium}</td>
                      </>
                    ) : null}
                    <td className="px-4 py-3 text-right text-[#d8cfc2] tabular-nums">{formatNumber(row.requests)}</td>
                    <td className="px-4 py-3 text-right text-[#d8cfc2] tabular-nums">{formatNumber(row.pax)}</td>
                    <td className="px-4 py-3 text-right text-emerald-200 tabular-nums">
                      {formatNumber(row.confirmed)}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-200 tabular-nums">{formatNumber(row.pending)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-8 text-sm text-[#a99d90]">{emptyLabel}</div>
      )}
    </OperationalPanel>
  );
}

function DetailTable({ rows }: { rows: AttributionRow[] }) {
  const latestRows = rows.slice(0, 50);

  return (
    <OperationalPanel className="overflow-hidden">
      <div className="border-b border-[#3c342a]/70 p-5">
        <h2 className="text-lg font-semibold text-[#f6f0e8]">Ultimas solicitudes externas</h2>
        <p className="mt-1 text-sm leading-6 text-[#a99d90]">
          Las 50 solicitudes mas recientes del rango seleccionado, con acceso directo al detalle operativo.
        </p>
      </div>
      {latestRows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#3c342a]/70 text-sm">
            <thead className="bg-[#12110f]/70 text-xs uppercase tracking-wide text-[#a99d90]">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Enviada
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Fecha reserva
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Hora
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Nombre
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Pax
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Origen
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Campaña
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Idioma
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Accion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3c342a]/70">
              {latestRows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-[#d8cfc2]">{formatDateTime(row.submitted_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#d8cfc2]">
                    {formatDate(row.group_event.event_date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#d8cfc2]">
                    {formatTime(row.group_event.entry_time)}
                  </td>
                  <td className="max-w-[13rem] px-4 py-3 font-medium text-[#f6f0e8]">
                    <span className="line-clamp-2">{cleanText(row.group_event.name) ?? 'Sin nombre'}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-[#d8cfc2] tabular-nums">{formatNumber(getPax(row))}</td>
                  <td className="px-4 py-3">
                    <OperationalPill tone={getStatusTone(row.group_event.status)}>
                      {getStatusLabel(row.group_event.status)}
                    </OperationalPill>
                  </td>
                  <td className="max-w-[12rem] px-4 py-3 text-[#d8cfc2]">
                    <span className="line-clamp-2">{normalizeSourceLabel(row.source_label)}</span>
                  </td>
                  <td className="max-w-[12rem] px-4 py-3 text-[#d8cfc2]">
                    <span className="line-clamp-2">{cleanText(row.utm_campaign) ?? '-'}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#d8cfc2]">
                    {normalizeLanguage(row.preferred_language)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/reservas/grupo/${row.group_event.id}`}
                      className="inline-flex items-center justify-end gap-1.5 text-sm font-semibold text-[#f1c98f] hover:text-[#ffe2b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/35"
                    >
                      Ver reserva
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-8 text-sm text-[#a99d90]">
          No hay solicitudes externas en el rango seleccionado.
        </div>
      )}
    </OperationalPanel>
  );
}

export default async function AdminExternalReservationAttributionPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  noStore();

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/reservas-externas/atribucion')}`);
  }

  const range = parseRange(searchParams?.range);
  const rangeFilter = getRangeFilter(range);
  const supabaseAdmin = createSupabaseAdminClient();

  let rows: AttributionRow[] = [];
  let loadError: string | null = null;

  try {
    rows = await fetchAttributionRows(supabaseAdmin, rangeFilter.startIso);
  } catch (error) {
    console.error('[admin/reservas-externas/atribucion] Failed to load attribution dashboard', error);
    loadError = 'No se pudo cargar la atribucion de reservas externas.';
  }

  const sourceRanking = buildSourceRanking(rows);
  const campaignRanking = buildCampaignRanking(rows);
  const languageRanking = buildLanguageRanking(rows);

  return (
    <>
      <OperationalPageHeader
        eyebrow="Admin"
        title="Atribucion reservas externas"
        description="Analiza de que canales y campanas vienen las solicitudes del motor publico."
        meta={
          <span className="inline-flex items-center gap-2">
            <MegaphoneIcon className="h-4 w-4" aria-hidden="true" />
            {rangeFilter.label}
          </span>
        }
        actions={
          <Link href="/admin/reservas-externas" className={operationalSecondaryButtonClass}>
            Configuracion reservas externas
          </Link>
        }
      />

      <OperationalPanel className="p-4">
        <RangeSelector currentRange={range} />
      </OperationalPanel>

      {loadError ? (
        <OperationalPanel className="border-rose-500/35 bg-rose-950/20 p-5 text-sm text-rose-100">
          {loadError}
        </OperationalPanel>
      ) : null}

      <MetricGrid rows={rows} rangeDescription={rangeFilter.metricDescription} />

      <div className="grid gap-4 xl:grid-cols-2">
        <RankingTable
          title="Ranking por origen"
          description="Agrupa por source_label guardado en la solicitud externa."
          rows={sourceRanking}
          emptyLabel="Todavia no hay origenes para el rango seleccionado."
        />
        <RankingTable
          title="Ranking por idioma"
          description="Agrupa por preferred_language declarado por el motor publico."
          rows={languageRanking}
          emptyLabel="Todavia no hay idiomas detectados para el rango seleccionado."
        />
      </div>

      <RankingTable
        title="Ranking por campaña"
        description="Agrupa por la combinacion utm_source + utm_medium + utm_campaign cuando la campaña existe."
        rows={campaignRanking}
        emptyLabel="No hay campañas UTM informadas en el rango seleccionado."
        showCampaignFields
      />

      <DetailTable rows={rows} />
    </>
  );
}
