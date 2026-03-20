'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import {
  type CheffingConsumerDish,
  type CheffingConsumerItem,
  getConservativeMarginDiagnostics,
  getConsumerConservativeCostTotal,
  getConsumerLineCost,
  getConsumerLineMargin,
  getConsumerLinePrice,
  getNextConsumerSortOrder,
  resolveConsumerDishKind,
} from '@/lib/cheffing/consumers';
import { normalizeSearchText } from '@/lib/cheffing/search';
import { formatEditableMoney, parseEditableMoney } from '@/lib/cheffing/money';
import { parsePortionMultiplier } from '@/lib/cheffing/portionMultiplier';

type HeaderState = {
  name: string;
  notes: string;
  is_active: boolean;
  price_per_person?: string;
};

export function CheffingConsumerEditor({
  mode,
  id,
  header,
  items,
  dishes,
}: {
  mode: 'menu' | 'card';
  id: string | null;
  header: HeaderState;
  items: CheffingConsumerItem[];
  dishes: CheffingConsumerDish[];
}) {
  const router = useRouter();
  const isMenu = mode === 'menu';
  const [headerState, setHeaderState] = useState(header);
  const [draftMultiplierByDish, setDraftMultiplierByDish] = useState<Record<string, string>>({});
  const [draftNotesByItemId, setDraftNotesByItemId] = useState<Record<string, string>>({});
  const [draftMultiplierByItemId, setDraftMultiplierByItemId] = useState<Record<string, string>>({});
  const [draftSortByItemId, setDraftSortByItemId] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'food' | 'drink'>('food');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiBasePath = mode === 'menu' ? '/api/cheffing/menus' : '/api/cheffing/cards';
  const uiBasePath = mode === 'menu' ? '/cheffing/menus' : '/cheffing/carta';

  const dishesById = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish])), [dishes]);

  const lines = useMemo(() => {
    return items
      .map((item) => {
        const dish = dishesById.get(item.dish_id) ?? null;
        const lineCost = getConsumerLineCost(dish?.items_cost_total ?? null, item.multiplier);
        const linePrice = getConsumerLinePrice(dish?.selling_price ?? null, item.multiplier);

        const lineIssues: string[] = [];
        if (!dish) {
          lineIssues.push('No se encontró el plato/bebida canónico para esta línea.');
        }
        if (lineCost === null) {
          lineIssues.push(`No se puede calcular el coste: "${dish?.name ?? 'Línea sin item'}" no tiene coste base calculable.`);
        }
        if (linePrice === null) {
          lineIssues.push(`No se puede calcular el PVP: "${dish?.name ?? 'Línea sin item'}" no tiene PVP base calculable.`);
        }

        return {
          ...item,
          dish,
          lineCost,
          linePrice,
          lineIssues,
          lineMargin: getConsumerLineMargin({ cost: lineCost, price: linePrice }),
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [dishesById, items]);

  const costDiagnostics = getConsumerConservativeCostTotal(
    lines.map((line) => ({
      lineName: line.dish?.name ?? 'Línea sin item',
      cost: line.lineCost,
    })),
  );
  const totalCost = costDiagnostics.total;

  const menuPrice = isMenu ? parseEditableMoney(headerState.price_per_person ?? '') : null;
  const menuMarginDiagnostics = isMenu
    ? getConservativeMarginDiagnostics({
        totalCost,
        price: menuPrice,
        label: `el menú "${headerState.name || 'sin nombre'}"`,
      })
    : { margin: null, blocking_reasons: [] as string[] };
  const menuMargin = menuMarginDiagnostics.margin;

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

  const filteredDishes = useMemo(() => {
    const query = normalizeSearchText(searchTerm);
    return dishes.filter((dish) => {
      if (resolveConsumerDishKind(dish) !== activeTab) return false;
      if (!query) return true;
      return normalizeSearchText(dish.name).includes(query);
    });
  }, [activeTab, dishes, searchTerm]);

  const saveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: headerState.name,
        notes: headerState.notes.trim() ? headerState.notes.trim() : null,
        is_active: headerState.is_active,
      };
      if (isMenu) {
        const parsedPrice = parseEditableMoney(headerState.price_per_person ?? '');
        if (parsedPrice !== null && parsedPrice < 0) {
          throw new Error('El precio por persona debe ser válido.');
        }
        payload.price_per_person = parsedPrice;
      }

      if (id) {
        const response = await fetch(`${apiBasePath}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? 'No se pudo actualizar.');
        }
      } else {
        const response = await fetch(apiBasePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body?.id) {
          throw new Error(body?.error ?? 'No se pudo crear.');
        }
        router.push(`${uiBasePath}/${body.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addLine = async (dishId: string) => {
    if (!id) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const multiplier = parsePortionMultiplier(draftMultiplierByDish[dishId]);
      if (multiplier === null) {
        throw new Error('El multiplicador debe ser mayor que 0.');
      }
      const response = await fetch(`${apiBasePath}/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: dishId,
          multiplier,
          sort_order: getNextConsumerSortOrder(lines),
          notes: null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo añadir la línea.');
      }
      setDraftMultiplierByDish((prev) => ({ ...prev, [dishId]: '1' }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveLine = async (item: CheffingConsumerItem) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const multiplierInput = draftMultiplierByItemId[item.id] ?? String(item.multiplier);
      const parsedMultiplier = parsePortionMultiplier(multiplierInput);
      if (parsedMultiplier === null) {
        throw new Error('El multiplicador debe ser mayor que 0.');
      }
      const parsedSort = Number(draftSortByItemId[item.id] ?? item.sort_order);
      if (!Number.isFinite(parsedSort)) {
        throw new Error('sort_order inválido.');
      }
      const response = await fetch(`${apiBasePath}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: item.dish_id,
          multiplier: parsedMultiplier,
          sort_order: Math.round(parsedSort),
          notes: (draftNotesByItemId[item.id] ?? item.notes ?? '').trim() || null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo actualizar la línea.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeLine = async (itemId: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBasePath}/items/${itemId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo eliminar la línea.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveHeader} className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-300">
            <span>Nombre</span>
            <input
              required
              value={headerState.name}
              onChange={(event) => setHeaderState((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            />
          </label>
          {isMenu ? (
            <label className="space-y-1 text-sm text-slate-300">
              <span>Precio por persona</span>
              <input
                value={headerState.price_per_person ?? ''}
                onChange={(event) => setHeaderState((prev) => ({ ...prev, price_per_person: event.target.value }))}
                placeholder="Ej: 35.50"
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm text-slate-300 md:col-span-2">
            <span>Notas</span>
            <textarea
              value={headerState.notes}
              onChange={(event) => setHeaderState((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
              className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={headerState.is_active}
              onChange={(event) => setHeaderState((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Activo
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
          <span>Coste total: {formatCurrency(totalCost)}</span>
          {isMenu ? <span>Precio persona: {formatCurrency(menuPrice)}</span> : null}
          {isMenu ? <span>Margen persona: {formatCurrency(menuMargin)}</span> : null}
        </div>
        {costDiagnostics.blocking_reasons.length > 0 ? (
          <p className="text-xs text-amber-300">{costDiagnostics.blocking_reasons[0]}</p>
        ) : null}
        {isMenu && menuMarginDiagnostics.blocking_reasons.length > 0 ? (
          <p className="text-xs text-amber-300">{menuMarginDiagnostics.blocking_reasons[0]}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:opacity-60"
        >
          Guardar cabecera
        </button>
      </form>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
        <h3 className="text-base font-semibold text-white">Líneas consumidoras</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-800/70">
          <table className="w-full min-w-[980px] text-left text-sm text-slate-200">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Familia</th>
                <th className="px-3 py-2">Multiplicador</th>
                <th className="px-3 py-2">sort_order</th>
                <th className="px-3 py-2">Coste</th>
                <th className="px-3 py-2">PVP</th>
                <th className="px-3 py-2">Margen</th>
                <th className="px-3 py-2">Diagnóstico</th>
                <th className="px-3 py-2">Notas</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-5 text-center text-slate-500">
                    No hay líneas.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className={`border-t border-slate-800/70 ${line.lineCost === null ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-3 py-2">{line.dish?.name ?? '—'}</td>
                    <td className="px-3 py-2">{line.dish?.family_name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <input
                        value={draftMultiplierByItemId[line.id] ?? String(line.multiplier)}
                        onChange={(event) =>
                          setDraftMultiplierByItemId((prev) => ({ ...prev, [line.id]: event.target.value }))
                        }
                        className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={draftSortByItemId[line.id] ?? String(line.sort_order)}
                        onChange={(event) => setDraftSortByItemId((prev) => ({ ...prev, [line.id]: event.target.value }))}
                        className="w-20 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">{formatCurrency(line.lineCost)}</td>
                    <td className="px-3 py-2">{formatCurrency(line.linePrice)}</td>
                    <td className="px-3 py-2">{formatCurrency(line.lineMargin)}</td>
                    <td className="px-3 py-2 text-xs text-amber-300">{line.lineIssues[0] ?? "—"}</td>
                    <td className="px-3 py-2">
                      <input
                        value={draftNotesByItemId[line.id] ?? line.notes ?? ''}
                        onChange={(event) => setDraftNotesByItemId((prev) => ({ ...prev, [line.id]: event.target.value }))}
                        className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveLine(line)}
                          className="rounded-full border border-slate-600 px-3 py-1 text-xs"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="rounded-full border border-rose-500/50 px-3 py-1 text-xs text-rose-200"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {id ? (
        <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">Añadir plato o bebida</h3>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre"
              className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex rounded-full border border-slate-700 bg-slate-950/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('food')}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                activeTab === 'food' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Platos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drink')}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                activeTab === 'drink' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Bebidas
            </button>
          </div>
          <ul className="max-h-[360px] divide-y divide-slate-800/70 overflow-y-auto rounded-xl border border-slate-800/70">
            {filteredDishes.map((dish) => (
              <li key={dish.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold text-white">{dish.name}</p>
                  <p className="text-xs text-slate-500">{dish.family_name ?? 'Sin familia'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={draftMultiplierByDish[dish.id] ?? '1'}
                    onChange={(event) =>
                      setDraftMultiplierByDish((prev) => ({ ...prev, [dish.id]: event.target.value }))
                    }
                    className="w-20 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                    aria-label={`Multiplicador ${dish.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => addLine(dish.id)}
                    className="rounded-full border border-slate-600 px-3 py-1 text-xs"
                  >
                    Añadir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export const menuHeaderDefaults = {
  name: '',
  notes: '',
  is_active: true,
  price_per_person: formatEditableMoney(null),
};

export const cardHeaderDefaults = {
  name: '',
  notes: '',
  is_active: true,
};
