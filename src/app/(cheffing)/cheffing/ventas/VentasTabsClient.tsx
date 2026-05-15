'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';

type ImportResult = {
  mode?: string;
  deleted?: { orders: number; items: number; sales_daily?: number };
  orders: { inserted: number; updated: number; total: number };
  items: { inserted: number; updated: number; total: number };
  dateRange: { from: string; to: string } | null;
  warnings: string[];
  durationMs: number;
};

type OrderRow = {
  pos_order_id: string;
  opened_at: string;
  outlet_id: string;
  clients: number | null;
  total_gross: number | null;
  status: string | null;
  discount_gross: number | null;
};

type ProductSalesRow = {
  pos_product_id: string;
  outlet_id: string;
  pos_product_name: string | null;
  units: number;
  revenue: number | null;
  dish_id: string | null;
  dish_name: string | null;
};

type Dish = { id: string; name: string };

const CSV_ACCEPT_ATTRIBUTE = '.csv,text/csv';

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

function isCsvFile(file: File): boolean {
  return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
}

type CsvFileDropzoneProps = {
  id: string;
  name: string;
  label: string;
  helper: string;
  file: File | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
};

function CsvFileDropzone({ id, name, label, helper, file, disabled = false, onFileChange }: CsvFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    if (!isCsvFile(nextFile)) {
      setDropError('Selecciona un archivo CSV.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setDropError(null);
    onFileChange(nextFile);
  }

  function clearFile() {
    setDropError(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        name={name}
        accept={CSV_ACCEPT_ATTRIBUTE}
        disabled={disabled}
        className="hidden"
        onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={file ? `${label}: ${file.name}` : label}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`min-h-40 cursor-pointer rounded-xl border border-dashed p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30 ${
          disabled
            ? 'cursor-not-allowed border-slate-800 bg-slate-950/30 opacity-70'
            : isDraggingOver
              ? 'border-emerald-400/80 bg-emerald-500/10'
              : 'border-slate-700 bg-slate-950/45 hover:border-slate-500 hover:bg-slate-900/55'
        }`}
      >
        <div className="flex h-full flex-col justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs leading-5 text-slate-400">{helper}</p>
          </div>

          {file ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="break-words text-sm font-semibold text-emerald-100">{file.name}</p>
              <p className="mt-1 text-xs text-emerald-200/80">{formatFileSize(file.size)}</p>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500">Toca o arrastra un CSV aqui.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex min-h-9 items-center rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {file ? 'Cambiar archivo' : 'Elegir archivo'}
        </button>
        {file ? (
          <button
            type="button"
            onClick={clearFile}
            disabled={disabled}
            className="inline-flex min-h-9 items-center rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Quitar
          </button>
        ) : null}
      </div>
      {dropError ? <p className="text-xs text-rose-300">{dropError}</p> : null}
    </div>
  );
}



function parseLocalTimestamp(ts: string): Date | null {
  if (!ts) return null;

  const [datePart, timePart = '00:00:00'] = ts.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
}

type ImportStatus = {
  lastOrder: { pos_order_id: string; opened_at: string } | null;
  range: { from: string; to: string } | null;
};

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function VentasTabsClient({
  initialOrders,
  productRows,
  dishes,
}: {
  initialOrders: OrderRow[];
  productRows: ProductSalesRow[];
  dishes: Dish[];
}) {
  const [tab, setTab] = useState<'import' | 'registro' | 'mapeo'>('import');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [mappingRows, setMappingRows] = useState(productRows);
  const [selectedDishByProduct, setSelectedDishByProduct] = useState<Record<string, string>>({});
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [importStatusLoading, setImportStatusLoading] = useState(true);
  const [ordersCsvFile, setOrdersCsvFile] = useState<File | null>(null);
  const [itemsCsvFile, setItemsCsvFile] = useState<File | null>(null);

  const filteredOrders = useMemo(() => {
    const text = query.toLowerCase().trim();
    if (!text) {
      return initialOrders;
    }
    return initialOrders.filter((order) =>
      [order.pos_order_id, order.outlet_id, order.status ?? ''].join(' ').toLowerCase().includes(text),
    );
  }, [initialOrders, query]);

  const PAGE_SIZE = 20;
  const visibleOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));


  useEffect(() => {
    let active = true;

    const loadImportStatus = async () => {
      setImportStatusLoading(true);
      try {
        const response = await fetch('/api/cheffing/pos/import-status');
        const json = await response.json();
        if (!response.ok) {
          if (active) {
            setImportStatus(null);
          }
          return;
        }

        if (active) {
          setImportStatus({
            lastOrder: json.lastOrder ?? null,
            range: json.range ?? null,
          });
        }
      } catch {
        if (active) {
          setImportStatus(null);
        }
      } finally {
        if (active) {
          setImportStatusLoading(false);
        }
      }
    };

    void loadImportStatus();

    return () => {
      active = false;
    };
  }, []);

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setImporting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    if (ordersCsvFile) formData.set('orders_csv', ordersCsvFile);
    if (itemsCsvFile) formData.set('items_csv', itemsCsvFile);

    try {
      const response = await fetch('/api/cheffing/pos/import-csv', {
        method: 'POST',
        body: formData,
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? 'No se pudo importar el CSV.');
        return;
      }
      setImportResult(json);

      try {
        const statusResponse = await fetch('/api/cheffing/pos/import-status');
        const statusJson = await statusResponse.json();
        if (statusResponse.ok) {
          setImportStatus({
            lastOrder: statusJson.lastOrder ?? null,
            range: statusJson.range ?? null,
          });
        }
      } catch {
        // No bloqueamos el resultado del import si falla el refresh de estado.
      }
    } catch {
      setError('Error de red al importar CSV.');
    } finally {
      setImporting(false);
    }
  };

  const handleAutoMatch = async () => {
    setError(null);
    const response = await fetch('/api/cheffing/pos/product-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'auto-match' }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? 'Error en auto-match.');
      return;
    }
    window.location.reload();
  };

  const lastDate = importStatus?.lastOrder ? parseLocalTimestamp(importStatus.lastOrder.opened_at) : null;

  const handleManualLink = async (posProductId: string) => {
    const dishId = selectedDishByProduct[posProductId];
    if (!dishId) {
      setError('Selecciona un plato antes de guardar el vínculo.');
      return;
    }

    const response = await fetch('/api/cheffing/pos/product-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link-manual', posProductId, dishId }),
    });
    const json = await response.json();

    if (!response.ok) {
      setError(json.error ?? 'No se pudo guardar el vínculo.');
      return;
    }

    const dish = dishes.find((d) => d.id === dishId);
    setMappingRows((current) =>
      current.map((row) =>
        row.pos_product_id === posProductId ? { ...row, dish_id: dishId, dish_name: dish?.name ?? row.dish_name } : row,
      ),
    );
  };

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Ventas POS</h2>
        <p className="text-sm text-slate-400">Importa CSVs de TPV, revisa pedidos y vincula productos con platos.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('import')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">
          Importar CSV
        </button>
        <button onClick={() => setTab('registro')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">
          Registro
        </button>
        <button onClick={() => setTab('mapeo')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">
          Mapeo TPV
        </button>
      </div>

      {error ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}

      {tab === 'import' ? (
        <div className="space-y-4">
          <p className="text-xs text-amber-200">
            Este import SOBREESCRIBE la BD para el rango de fechas incluido en el CSV (Fecha de apertura).
            El último CSV subido manda.
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
            {importStatusLoading ? (
              <p>Cargando estado de importación…</p>
            ) : importStatus?.lastOrder || importStatus?.range ? (
              <div className="space-y-1">
                <p>
                  Último importado:{' '}
                  {importStatus?.lastOrder
                    ? `${lastDate ? dateFormatter.format(lastDate) : 'No disponible'} (pedido ${importStatus.lastOrder.pos_order_id})`
                    : 'No disponible'}
                </p>
                <p>
                  Rango en BD:{' '}
                  {importStatus?.range ? `${importStatus.range.from} → ${importStatus.range.to}` : 'No disponible'}
                </p>
              </div>
            ) : (
              <p>Aún no hay importaciones.</p>
            )}
          </div>
          <form onSubmit={handleImport} className="grid gap-4 rounded-xl border border-slate-800 p-4 md:grid-cols-2">
            <CsvFileDropzone
              id="orders_csv"
              name="orders_csv"
              label="CSV pedidos totales"
              helper="Archivo orders_csv del TPV con pedidos totales."
              file={ordersCsvFile}
              disabled={importing}
              onFileChange={setOrdersCsvFile}
            />
            <CsvFileDropzone
              id="items_csv"
              name="items_csv"
              label="CSV pedidos por producto"
              helper="Archivo items_csv del TPV con lÃ­neas o productos vendidos."
              file={itemsCsvFile}
              disabled={importing}
              onFileChange={setItemsCsvFile}
            />
            <button
              type="submit"
              disabled={importing}
              className="rounded-lg border border-emerald-500/70 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100"
            >
              {importing ? 'Importando…' : 'Importar'}
            </button>
          </form>

          {importResult ? (
            <div className="space-y-2 rounded-xl border border-slate-800 p-4 text-sm text-slate-200">
              <p>
                Pedidos: {importResult.orders.inserted} insertados / {importResult.orders.updated} actualizados.
              </p>
              <p>
                Líneas: {importResult.items.inserted} insertadas / {importResult.items.updated} actualizadas.
              </p>
              <p>
                Rango: {importResult.dateRange?.from ?? '—'} → {importResult.dateRange?.to ?? '—'} · {importResult.durationMs} ms.
              </p>
              {importResult.deleted ? (
                <p>
                  Borrado en rango: {importResult.deleted.orders} pedidos / {importResult.deleted.items} líneas
                  {typeof importResult.deleted.sales_daily === 'number'
                    ? ` / ${importResult.deleted.sales_daily} filas de ventas diarias`
                    : ''}.
                </p>
              ) : null}
              {importResult.warnings.length > 0 ? (
                <ul className="list-disc pl-5 text-amber-200">
                  {importResult.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'registro' ? (
        <div className="space-y-4">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Filtrar por pedido, local o estado"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm"
          />
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[860px] text-left text-sm text-slate-200">
              <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Fecha apertura</th>
                  <th className="px-3 py-2">Pedido</th>
                  <th className="px-3 py-2">Outlet</th>
                  <th className="px-3 py-2">Clientes</th>
                  <th className="px-3 py-2">Total bruto</th>
                  <th className="px-3 py-2">Descuento</th>
                  <th className="px-3 py-2">Payment status</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((row) => (
                  <tr key={row.pos_order_id} className="border-t border-slate-800">
                    <td className="px-3 py-2">{new Date(row.opened_at).toLocaleString('es-ES')}</td>
                    <td className="px-3 py-2 text-emerald-200">
                      <Link href={`/cheffing/ventas/${encodeURIComponent(row.pos_order_id)}`}>{row.pos_order_id}</Link>
                    </td>
                    <td className="px-3 py-2">{row.outlet_id}</td>
                    <td className="px-3 py-2">{row.clients ?? '—'}</td>
                    <td className="px-3 py-2">{row.total_gross === null ? '—' : currencyFormatter.format(row.total_gross)}</td>
                    <td className="px-3 py-2">{row.discount_gross === null ? '—' : currencyFormatter.format(row.discount_gross)}</td>
                    <td className="px-3 py-2">{row.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Siguiente →
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'mapeo' ? (
        <div className="space-y-4">
          <button onClick={handleAutoMatch} className="rounded-lg border border-emerald-500/70 px-3 py-2 text-sm">
            Auto-match por nombre exacto
          </button>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[920px] text-left text-sm">
              <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Outlet</th>
                  <th className="px-3 py-2">Producto TPV</th>
                  <th className="px-3 py-2">Units</th>
                  <th className="px-3 py-2">Revenue</th>
                  <th className="px-3 py-2">Link actual</th>
                  <th className="px-3 py-2">Vincular manual</th>
                </tr>
              </thead>
              <tbody>
                {mappingRows.map((row) => (
                  <tr key={row.pos_product_id} className="border-t border-slate-800">
                    <td className="px-3 py-2">{row.outlet_id}</td>
                    <td className="px-3 py-2">{row.pos_product_name ?? row.pos_product_id}</td>
                    <td className="px-3 py-2">{row.units}</td>
                    <td className="px-3 py-2">{row.revenue === null ? '—' : currencyFormatter.format(row.revenue)}</td>
                    <td className="px-3 py-2">{row.dish_name ?? 'Sin mapear'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <select
                          value={selectedDishByProduct[row.pos_product_id] ?? ''}
                          onChange={(event) =>
                            setSelectedDishByProduct((current) => ({ ...current, [row.pos_product_id]: event.target.value }))
                          }
                          className="rounded border border-slate-700 bg-slate-950/50 px-2 py-1"
                        >
                          <option value="">Seleccionar plato</option>
                          {dishes.map((dish) => (
                            <option key={dish.id} value={dish.id}>
                              {dish.name}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => handleManualLink(row.pos_product_id)} className="rounded border px-2 py-1">
                          Guardar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
