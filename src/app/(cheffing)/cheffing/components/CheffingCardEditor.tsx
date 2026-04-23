'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { CheffingConsumerDish } from '@/lib/cheffing/consumers';
import { getNextConsumerSortOrder, resolveConsumerDishHref, resolveConsumerDishKind } from '@/lib/cheffing/consumers';
import { normalizeSearchText } from '@/lib/cheffing/search';
import { useCheffingToast } from '@/app/(cheffing)/cheffing/components/CheffingToastProvider';

type HeaderState = {
  name: string;
  notes: string;
  is_active: boolean;
};

type CardItem = {
  id: string;
  dish_id: string;
  multiplier: number;
  sort_order: number;
  notes: string | null;
};

export const cardHeaderDefaults: HeaderState = {
  name: '',
  notes: '',
  is_active: true,
};

export function CheffingCardEditor({
  id,
  header,
  items,
  dishes,
}: {
  id: string | null;
  header: HeaderState;
  items: CardItem[];
  dishes: CheffingConsumerDish[];
}) {
  const router = useRouter();
  const [headerState, setHeaderState] = useState(header);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'food' | 'drink'>('food');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [draftSortByItemId, setDraftSortByItemId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const { showToast } = useCheffingToast();

  const dishesById = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish])), [dishes]);

  const lines = useMemo(
    () =>
      items
        .map((item) => ({
          ...item,
          dish: dishesById.get(item.dish_id) ?? null,
        }))
        .sort((a, b) => a.sort_order - b.sort_order),
    [dishesById, items],
  );

  const filteredDishes = useMemo(() => {
    const query = normalizeSearchText(searchTerm);
    return dishes.filter((dish) => {
      if (resolveConsumerDishKind(dish) !== activeTab) return false;
      if (!query) return true;
      return normalizeSearchText(dish.name).includes(query);
    });
  }, [activeTab, dishes, searchTerm]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

  const saveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmittingAction(id ? 'Guardando...' : 'Creando...');
    setIsSubmitting(true);

    try {
      const payload = {
        name: headerState.name,
        notes: headerState.notes.trim() ? headerState.notes.trim() : null,
        is_active: headerState.is_active,
      };

      if (id) {
        const response = await fetch(`/api/cheffing/cards/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? 'No se pudo actualizar la carta.');
        }
      } else {
        const response = await fetch('/api/cheffing/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body?.id) {
          throw new Error(body?.error ?? 'No se pudo crear la carta.');
        }
        router.push(`/cheffing/carta/${body.id}`);
      }

      showToast({ type: 'success', title: id ? 'Cambios de la carta guardados' : 'Carta creada' });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      showToast({ type: 'error', title: message });
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const addItem = async (dishId: string) => {
    if (!id) return;
    setError(null);
    setSubmittingAction('Añadiendo...');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/cheffing/cards/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: dishId,
          sort_order: getNextConsumerSortOrder(lines),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo añadir el item a la carta.');
      }

      showToast({ type: 'success', title: 'Línea añadida' });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      showToast({ type: 'error', title: message });
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const saveItem = async (item: CardItem) => {
    setError(null);
    setSubmittingAction('Guardando...');
    setIsSubmitting(true);

    try {
      const parsedSort = Number(draftSortByItemId[item.id] ?? item.sort_order);
      if (!Number.isFinite(parsedSort)) {
        throw new Error('sort_order inválido.');
      }

      const response = await fetch(`/api/cheffing/cards/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: item.dish_id,
          sort_order: Math.round(parsedSort),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo guardar el item.');
      }

      showToast({ type: 'success', title: 'Línea guardada' });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      showToast({ type: 'error', title: message });
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setError(null);
    setSubmittingAction('Eliminando...');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/cheffing/cards/items/${itemId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo eliminar el item.');
      }

      showToast({ type: 'success', title: 'Línea eliminada' });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      showToast({ type: 'error', title: message });
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
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
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={headerState.is_active}
              onChange={(event) => setHeaderState((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Activa
          </label>
          <label className="space-y-1 text-sm text-slate-300 md:col-span-2">
            <span>Notas</span>
            <textarea
              value={headerState.notes}
              onChange={(event) => setHeaderState((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
              className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:opacity-60"
        >
          {isSubmitting ? (submittingAction ?? 'Guardando...') : id ? 'Guardar cambios de la carta' : 'Crear carta'}
        </button>
      </form>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
        <h3 className="text-base font-semibold text-white">Items de carta</h3>
        <p className="text-xs text-slate-400">Colección comercial: la composición y economía se edita en Platos/Bebidas.</p>
        <div className="overflow-x-auto rounded-xl border border-slate-800/70">
          <table className="w-full min-w-[900px] text-left text-sm text-slate-200">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Familia</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">PVP heredado</th>
                <th className="px-3 py-2">Coste heredado</th>
                <th className="px-3 py-2">sort_order</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-slate-500">
                    No hay items asociados.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="border-t border-slate-800/70">
                    <td className="px-3 py-2 font-medium text-white">
                      {line.dish ? (
                        <Link
                          href={resolveConsumerDishHref(line.dish)}
                          className="font-semibold text-white underline-offset-2 transition hover:text-emerald-200 hover:underline"
                        >
                          {line.dish.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">{line.dish?.family_name ?? 'Sin familia'}</td>
                    <td className="px-3 py-2">{line.dish?.family_kind === 'drink' ? 'Bebida' : 'Plato'}</td>
                    <td className="px-3 py-2">{formatCurrency(line.dish?.selling_price ?? null)}</td>
                    <td className="px-3 py-2">{formatCurrency(line.dish?.items_cost_total ?? null)}</td>
                    <td className="px-3 py-2">
                      <input
                        value={draftSortByItemId[line.id] ?? String(line.sort_order)}
                        onChange={(event) => setDraftSortByItemId((prev) => ({ ...prev, [line.id]: event.target.value }))}
                        className="w-20 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveItem(line)} disabled={isSubmitting} className="rounded-full border border-slate-600 px-3 py-1 text-xs disabled:opacity-60">
                          {isSubmitting ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(line.id)}
                          disabled={isSubmitting}
                          className="rounded-full border border-rose-500/50 px-3 py-1 text-xs text-rose-200 disabled:opacity-60"
                        >
                          {isSubmitting ? 'Eliminando...' : 'Quitar'}
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
          <button
            type="button"
            onClick={() => setIsAddOpen((prev) => !prev)}
            className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200"
          >
            {isAddOpen ? 'Cerrar añadir platos o bebidas' : 'Añadir platos o bebidas'}
          </button>

          {isAddOpen ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Añadir platos o bebidas</h3>
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
                    <button
                      type="button"
                      onClick={() => addItem(dish.id)}
                      disabled={isSubmitting}
                      className="rounded-full border border-slate-600 px-3 py-1 text-xs disabled:opacity-60"
                    >
                      {isSubmitting ? 'Añadiendo...' : 'Añadir'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Guarda primero la carta para poder asociar platos y bebidas.</p>
      )}
    </div>
  );
}
