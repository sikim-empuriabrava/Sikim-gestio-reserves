'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';

type ImportResult = {
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

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

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

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setImporting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

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
          <form onSubmit={handleImport} className="grid gap-4 rounded-xl border border-slate-800 p-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              CSV pedidos totales (orders_csv)
              <input type="file" name="orders_csv" accept=".csv,text/csv" className="block w-full text-sm" />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              CSV pedidos por producto (items_csv)
              <input type="file" name="items_csv" accept=".csv,text/csv" className="block w-full text-sm" />
            </label>
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
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm text-slate-200">
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
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
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
