'use client';

import type { ReactNode } from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ChartPoint, ClosingQuality, SessionBarPoint, WeekdayChartPoint } from '@/lib/disco/capacityHistory';

const COPPER = '#d08a39';
const GOLD = '#f1c98f';
const GRAPHITE_GRID = 'rgba(148, 132, 111, 0.28)';

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-xl border border-slate-800/70 bg-slate-950/35 px-4 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-xs shadow-2xl shadow-black/30">
      <p className="font-semibold text-slate-100">{label}</p>
      <div className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <p key={`${entry.name}-${entry.value}`} className="tabular-nums text-slate-300">
            <span style={{ color: entry.color ?? COPPER }}>●</span> {entry.name}: {entry.value?.toLocaleString('es-ES') ?? '-'}
          </p>
        ))}
      </div>
    </div>
  );
}

function ChartFrame({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800/75 bg-slate-900/60 p-4 shadow-[0_22px_64px_-48px_rgba(0,0,0,0.8)]">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function lineChart(data: ChartPoint[]) {
  if (data.length === 0) {
    return <EmptyChart message="No hay suficientes movimientos para dibujar la evolucion." />;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 18, bottom: 8, left: -18 }}>
          <CartesianGrid stroke={GRAPHITE_GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#b9aea1', fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRAPHITE_GRID }} minTickGap={18} />
          <YAxis tick={{ fill: '#b9aea1', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="value" name="Aforo" stroke={COPPER} strokeWidth={3} dot={false} activeDot={{ r: 5, fill: GOLD, stroke: COPPER }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function barChart(data: SessionBarPoint[], name: string, color = COPPER) {
  if (data.length === 0) {
    return <EmptyChart message="No hay sesiones en el rango seleccionado." />;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -18 }}>
          <CartesianGrid stroke={GRAPHITE_GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#b9aea1', fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRAPHITE_GRID }} minTickGap={10} />
          <YAxis tick={{ fill: '#b9aea1', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name={name} radius={[6, 6, 2, 2]} fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SessionEvolutionChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartFrame title="Evolucion de la sesion" description="Linea temporal del aforo registrado durante la noche.">
      {lineChart(data)}
    </ChartFrame>
  );
}

export function CapacityAnalyticsCharts({
  averageEvolution,
  entriesBySession,
  peakBySession,
  weekdayComparison,
  closingQuality,
}: {
  averageEvolution: ChartPoint[];
  entriesBySession: SessionBarPoint[];
  peakBySession: SessionBarPoint[];
  weekdayComparison: WeekdayChartPoint[];
  closingQuality: ClosingQuality;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartFrame title="Evolucion media del aforo" description="Media por franjas de 15 minutos en el rango seleccionado.">
        {lineChart(averageEvolution)}
      </ChartFrame>

      <ChartFrame title="Entradas registradas por sesion" description="Suma de movimientos de entrada. No equivale necesariamente a clientes unicos.">
        {barChart(entriesBySession, 'Entradas')}
      </ChartFrame>

      <ChartFrame title="Pico maximo por sesion" description="Peak count guardado en cada sesion cerrada.">
        {barChart(peakBySession, 'Pico maximo', GOLD)}
      </ChartFrame>

      <ChartFrame title="Comparativa por dia de semana" description="Entradas totales y pico medio por dia de apertura.">
        {weekdayComparison.length === 0 ? (
          <EmptyChart message="No hay sesiones para comparar por dia." />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayComparison} margin={{ top: 8, right: 16, bottom: 8, left: -18 }}>
                <CartesianGrid stroke={GRAPHITE_GRID} vertical={false} />
                <XAxis dataKey="weekday" tick={{ fill: '#b9aea1', fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRAPHITE_GRID }} />
                <YAxis tick={{ fill: '#b9aea1', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color: '#b9aea1', fontSize: 12 }} />
                <Bar dataKey="entries" name="Entradas" radius={[6, 6, 2, 2]} fill={COPPER} />
                <Bar dataKey="averagePeak" name="Pico medio" radius={[6, 6, 2, 2]} fill={GOLD} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartFrame>

      <ChartFrame title="Calidad de cierre" description="Util para detectar cierres con contador sin cuadrar.">
        <div className="grid h-72 content-center gap-3 sm:grid-cols-2">
          <div className="border-l border-emerald-400/45 pl-4">
            <p className="text-sm text-slate-400">Aforo final 0</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-300">{closingQuality.finalZeroSessions.toLocaleString('es-ES')}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Sesiones cerradas con contador cuadrado.</p>
          </div>
          <div className="border-l border-amber-300/45 pl-4">
            <p className="text-sm text-slate-400">Aforo final distinto de 0</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-amber-200">{closingQuality.finalNonZeroSessions.toLocaleString('es-ES')}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Revisar si el cierre operativo no cuadraba.</p>
          </div>
          {closingQuality.finalNonZeroSessions > 0 ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 sm:col-span-2">
              Hay sesiones cerradas con aforo final no cero.
            </p>
          ) : null}
        </div>
      </ChartFrame>
    </div>
  );
}

