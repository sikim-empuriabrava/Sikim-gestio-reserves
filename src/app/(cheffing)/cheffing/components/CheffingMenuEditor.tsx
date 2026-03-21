'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import {
  type CheffingConsumerDish,
  type CheffingConsumerItem,
  getConservativeMarginDiagnostics,
  getConsumerLineCost,
  getNextConsumerSortOrder,
  resolveConsumerDishKind,
} from '@/lib/cheffing/consumers';
import { getMenuConservativeCostDiagnostics, getNetPriceFromGross, type MenuSectionKind } from '@/lib/cheffing/menuEconomics';
import { normalizeSearchText } from '@/lib/cheffing/search';
import { formatEditableMoney, parseEditableMoney } from '@/lib/cheffing/money';
import { parsePortionMultiplier } from '@/lib/cheffing/portionMultiplier';
import { normalizeMenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';
import { useCheffingToast } from '@/app/(cheffing)/cheffing/components/CheffingToastProvider';

type HeaderState = {
  name: string;
  notes: string;
  is_active: boolean;
  price_per_person: string;
};

const sectionConfig: Array<{ kind: MenuSectionKind; label: string; dishKind: 'food' | 'drink' | 'all' }> = [
  { kind: 'starter', label: 'Entrantes', dishKind: 'food' },
  { kind: 'main', label: 'Segundos', dishKind: 'food' },
  { kind: 'drink', label: 'Bebidas', dishKind: 'drink' },
  { kind: 'dessert', label: 'Postres', dishKind: 'food' },
];

export const menuHeaderDefaults: HeaderState = {
  name: '',
  notes: '',
  is_active: true,
  price_per_person: formatEditableMoney(null),
};

export function CheffingMenuEditor({
  id,
  header,
  items,
  dishes,
}: {
  id: string | null;
  header: HeaderState;
  items: CheffingConsumerItem[];
  dishes: CheffingConsumerDish[];
}) {
  const router = useRouter();
  const [headerState, setHeaderState] = useState(header);
  const [searchBySection, setSearchBySection] = useState<Record<MenuSectionKind, string>>({
    starter: '',
    main: '',
    drink: '',
    dessert: '',
  });
  const [draftMultiplierByDishAndSection, setDraftMultiplierByDishAndSection] = useState<Record<string, string>>({});
  const [draftMultiplierByItemId, setDraftMultiplierByItemId] = useState<Record<string, string>>({});
  const [draftSortByItemId, setDraftSortByItemId] = useState<Record<string, string>>({});
  const [openSection, setOpenSection] = useState<MenuSectionKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const { showToast } = useCheffingToast();

  const dishesById = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish])), [dishes]);

  const lines = useMemo(
    () =>
      items
        .map((item) => {
          const dish = dishesById.get(item.dish_id) ?? null;
          const lineCost = getConsumerLineCost(dish?.items_cost_total ?? null, item.multiplier);
          return {
            ...item,
            section_kind: item.section_kind ?? 'starter',
            dish,
            lineCost,
            lineIssue:
              lineCost === null
                ? `No se puede calcular el coste: "${dish?.name ?? 'Línea sin item'}" no tiene coste base calculable.`
                : null,
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order),
    [dishesById, items],
  );

  const totalDiagnostics = getMenuConservativeCostDiagnostics(
    lines.map((line) => ({
      section_kind: line.section_kind,
      lineName: line.dish?.name ?? 'Línea sin item',
      cost: line.lineCost,
    })),
  );

  const menuPrice = parseEditableMoney(headerState.price_per_person);
  const vatRate = normalizeMenuEngineeringVatRate(undefined);
  const netMenuPrice = getNetPriceFromGross(menuPrice, vatRate);
  const marginDiagnostics = getConservativeMarginDiagnostics({
    totalCost: totalDiagnostics.total,
    price: netMenuPrice,
    label: `el menú "${headerState.name || 'sin nombre'}"`,
  });

  const groupedLines = useMemo(() => {
    const grouped = new Map<MenuSectionKind, typeof lines>();
    sectionConfig.forEach((section) => grouped.set(section.kind, []));
    lines.forEach((line) => {
      const sectionKind = (line.section_kind ?? 'starter') as MenuSectionKind;
      const current = grouped.get(sectionKind) ?? [];
      current.push(line);
      grouped.set(sectionKind, current);
    });
    return grouped;
  }, [lines]);

  const sectionSummaryByKind = useMemo(() => {
    return new Map(
      sectionConfig.map((section) => {
        const sectionDiagnostics = totalDiagnostics.sections[section.kind];
        const sectionCost = sectionDiagnostics.cost;
        const sectionPct = sectionCost !== null && netMenuPrice !== null && netMenuPrice > 0 ? (sectionCost / netMenuPrice) * 100 : null;
        return [
          section.kind,
          {
            cost: sectionCost,
            pct: sectionPct,
            warning: sectionDiagnostics.blocking_reasons[0] ?? null,
          },
        ] as const;
      }),
    );
  }, [netMenuPrice, totalDiagnostics.sections]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} %`;
  };

  const saveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmittingAction(id ? 'Guardando...' : 'Creando...');
    setIsSubmitting(true);

    try {
      const parsedPrice = parseEditableMoney(headerState.price_per_person);
      if (parsedPrice !== null && parsedPrice < 0) {
        throw new Error('El precio por persona debe ser válido.');
      }

      const payload = {
        name: headerState.name,
        notes: headerState.notes.trim() ? headerState.notes.trim() : null,
        is_active: headerState.is_active,
        price_per_person: parsedPrice,
      };

      if (id) {
        const response = await fetch(`/api/cheffing/menus/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? 'No se pudo actualizar el menú.');
        }
      } else {
        const response = await fetch('/api/cheffing/menus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body?.id) {
          throw new Error(body?.error ?? 'No se pudo crear el menú.');
        }
        router.push(`/cheffing/menus/${body.id}`);
      }

      showToast({ type: 'success', title: id ? 'Cambios del menú guardados' : 'Menú creado' });
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

  const addItem = async (dishId: string, sectionKind: MenuSectionKind) => {
    if (!id) return;
    setError(null);
    setSubmittingAction('Añadiendo...');
    setIsSubmitting(true);

    try {
      const draftKey = `${sectionKind}:${dishId}`;
      const multiplier = parsePortionMultiplier(draftMultiplierByDishAndSection[draftKey] ?? '1');
      if (multiplier === null) {
        throw new Error('El multiplicador debe ser mayor que 0.');
      }

      const sectionLines = groupedLines.get(sectionKind) ?? [];
      const response = await fetch(`/api/cheffing/menus/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: dishId,
          section_kind: sectionKind,
          multiplier,
          sort_order: getNextConsumerSortOrder(sectionLines),
          notes: null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo añadir la línea.');
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

  const saveItem = async (item: CheffingConsumerItem & { section_kind: MenuSectionKind }) => {
    setError(null);
    setSubmittingAction('Guardando...');
    setIsSubmitting(true);

    try {
      const parsedMultiplier = parsePortionMultiplier(draftMultiplierByItemId[item.id] ?? String(item.multiplier));
      if (parsedMultiplier === null) {
        throw new Error('El multiplicador debe ser mayor que 0.');
      }

      const parsedSort = Number(draftSortByItemId[item.id] ?? item.sort_order);
      if (!Number.isFinite(parsedSort)) {
        throw new Error('sort_order inválido.');
      }

      const response = await fetch(`/api/cheffing/menus/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: item.dish_id,
          section_kind: item.section_kind,
          multiplier: parsedMultiplier,
          sort_order: Math.round(parsedSort),
          notes: null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo actualizar la línea.');
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
      const response = await fetch(`/api/cheffing/menus/items/${itemId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo eliminar la línea.');
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

  const filteredDishesBySection = useMemo(() => {
    return new Map(
      sectionConfig.map((section) => {
        const normalizedSearch = normalizeSearchText(searchBySection[section.kind]);
        const filtered = dishes.filter((dish) => {
          const dishKind = resolveConsumerDishKind(dish);
          if (section.dishKind === 'food' && dishKind !== 'food') return false;
          if (section.dishKind === 'drink' && dishKind !== 'drink') return false;
          if (!normalizedSearch) return true;
          return normalizeSearchText(dish.name).includes(normalizedSearch);
        });
        return [section.kind, filtered] as const;
      }),
    );
  }, [dishes, searchBySection]);

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
          <label className="space-y-1 text-sm text-slate-300">
            <span>Precio por persona</span>
            <input
              value={headerState.price_per_person}
              onChange={(event) => setHeaderState((prev) => ({ ...prev, price_per_person: event.target.value }))}
              placeholder="Ej: 35.50"
              className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            />
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
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={headerState.is_active}
              onChange={(event) => setHeaderState((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Activo
          </label>
        </div>

        <div className="grid gap-2 rounded-xl border border-slate-800/70 bg-slate-950/70 p-3 text-sm text-slate-200 md:grid-cols-3">
          <p>Coste total por persona: <strong>{formatCurrency(totalDiagnostics.total)}</strong></p>
          <p>Precio por persona: <strong>{formatCurrency(menuPrice)}</strong></p>
          <p>Precio sin IVA: <strong>{formatCurrency(netMenuPrice)}</strong></p>
          <p>Margen por persona: <strong>{formatCurrency(marginDiagnostics.margin)}</strong></p>
          <p>Margen %: <strong>{formatPercentage(marginDiagnostics.margin !== null && netMenuPrice !== null && netMenuPrice > 0 ? (marginDiagnostics.margin / netMenuPrice) * 100 : null)}</strong></p>
        </div>

        {totalDiagnostics.blocking_reasons.length > 0 ? <p className="text-xs text-amber-300">{totalDiagnostics.blocking_reasons[0]}</p> : null}
        {marginDiagnostics.blocking_reasons.length > 0 ? <p className="text-xs text-amber-300">{marginDiagnostics.blocking_reasons[0]}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:opacity-60"
        >
          {isSubmitting ? (submittingAction ?? 'Guardando...') : id ? 'Guardar cambios del menú' : 'Crear menú'}
        </button>
      </form>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {sectionConfig.map((section) => {
        const sectionLines = groupedLines.get(section.kind) ?? [];
        const sectionSummary = sectionSummaryByKind.get(section.kind);
        const filteredDishes = filteredDishesBySection.get(section.kind) ?? [];

        return (
          <div key={section.kind} className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">{section.label}</h3>
              <span className="text-xs text-slate-500">{sectionLines.length} líneas</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/70">
              <table className="w-full min-w-[820px] text-left text-sm text-slate-200">
                <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Familia</th>
                    <th className="px-3 py-2">Multiplicador</th>
                    <th className="px-3 py-2">sort_order</th>
                    <th className="px-3 py-2">Coste línea</th>
                    <th className="px-3 py-2">% s/ PVP neto menú</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-5 text-center text-slate-500">
                        No hay líneas todavía en esta sección.
                      </td>
                    </tr>
                  ) : (
                    sectionLines.map((line) => (
                      <tr key={line.id} className={`border-t border-slate-800/70 ${line.lineCost === null ? 'bg-amber-500/5' : ''}`}>
                        <td className="px-3 py-2 font-medium text-white">{line.dish?.name ?? '—'}</td>
                        <td className="px-3 py-2">{line.dish?.family_name ?? 'Sin familia'}</td>
                        <td className="px-3 py-2">
                          <input
                            value={draftMultiplierByItemId[line.id] ?? String(line.multiplier)}
                            onChange={(event) => setDraftMultiplierByItemId((prev) => ({ ...prev, [line.id]: event.target.value }))}
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
                        <td className="px-3 py-2">
                          {formatPercentage(line.lineCost !== null && netMenuPrice !== null && netMenuPrice > 0 ? (line.lineCost / netMenuPrice) * 100 : null)}
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
                              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-800/50 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <p>
                  {section.kind === 'main' ? 'Coste medio sección' : 'Coste sección'}: <strong>{formatCurrency(sectionSummary?.cost ?? null)}</strong>
                </p>
                <p>
                  % s/ PVP neto menú:{' '}
                  <strong>
                    {formatPercentage(
                      sectionSummary?.cost === 0 && netMenuPrice !== null && netMenuPrice > 0
                        ? 0
                        : (sectionSummary?.pct ?? null),
                    )}
                  </strong>
                </p>
              </div>
              {sectionSummary?.warning ? <p className="mt-1 text-amber-300">{sectionSummary.warning}</p> : null}
            </div>

            {id ? (
              <>
                <button
                  type="button"
                  onClick={() => setOpenSection((prev) => (prev === section.kind ? null : section.kind))}
                  className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200"
                >
                  {openSection === section.kind ? 'Cerrar añadir ítems' : 'Añadir ítems'}
                </button>

                {openSection === section.kind ? (
                  <div className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-300">Añadir línea a {section.label.toLowerCase()}</p>
                      <input
                        type="search"
                        value={searchBySection[section.kind]}
                        onChange={(event) => setSearchBySection((prev) => ({ ...prev, [section.kind]: event.target.value }))}
                        placeholder="Buscar por nombre"
                        className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <ul className="max-h-[260px] divide-y divide-slate-800/70 overflow-y-auto rounded-xl border border-slate-800/70">
                      {filteredDishes.map((dish) => {
                        const draftKey = `${section.kind}:${dish.id}`;
                        return (
                          <li key={dish.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div>
                              <p className="font-semibold text-white">{dish.name}</p>
                              <p className="text-xs text-slate-500">{dish.family_name ?? 'Sin familia'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                value={draftMultiplierByDishAndSection[draftKey] ?? '1'}
                                onChange={(event) =>
                                  setDraftMultiplierByDishAndSection((prev) => ({ ...prev, [draftKey]: event.target.value }))
                                }
                                className="w-20 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                                aria-label={`Multiplicador ${dish.name}`}
                              />
                              <button
                                type="button"
                                onClick={() => addItem(dish.id, section.kind)}
                                disabled={isSubmitting}
                                className="rounded-full border border-slate-600 px-3 py-1 text-xs disabled:opacity-60"
                              >
                                {isSubmitting ? 'Añadiendo...' : 'Añadir'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-400">Guarda primero el menú para poder añadir líneas a esta sección.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
