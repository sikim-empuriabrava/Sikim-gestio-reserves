'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircleIcon,
  CurrencyEuroIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PhotoIcon,
  ScaleIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { DataTableShell, MetricCard, MetricStrip, StatusBadge, Toolbar, cn } from '@/components/ui';
import type { IngredientCost, Unit, UnitDimension } from '@/lib/cheffing/types';
import { formatEditableMoney, parseEditableMoney } from '@/lib/cheffing/money';
import { normalizeSearchText } from '@/lib/cheffing/search';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const displayUnitByDimension: Record<UnitDimension, 'kg' | 'l' | 'u'> = {
  mass: 'kg',
  volume: 'l',
  unit: 'u',
};

type ProductsManagerProps = {
  initialIngredients: IngredientCost[];
  units: Unit[];
};

type IngredientFormState = {
  name: string;
  purchase_unit_code: string;
  purchase_pack_qty: string;
  purchase_price: string;
  waste_pct: string;
};

type SortDirection = 'asc' | 'desc';
type ProductSortKey =
  | 'name'
  | 'purchase_pack_qty'
  | 'purchase_price'
  | 'waste_pct'
  | 'waste_factor'
  | 'cost_gross_per_base'
  | 'cost_net_per_base';

const sortLabelByKey: Record<ProductSortKey, string> = {
  name: 'Nombre',
  purchase_pack_qty: 'Compra',
  purchase_price: 'Precio pack',
  waste_pct: 'Merma',
  waste_factor: 'FC',
  cost_gross_per_base: 'Coste bruto',
  cost_net_per_base: 'Coste neto',
};

export function ProductsManager({ initialIngredients, units }: ProductsManagerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<IngredientFormState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortState, setSortState] = useState<{ key: ProductSortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => a.code.localeCompare(b.code));
  }, [units]);

  const formatDisplayCost = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatInternalCost = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const resolveDisplayCost = (costPerBase: number | null, dimension: UnitDimension | null) => {
    if (costPerBase === null || Number.isNaN(costPerBase) || !dimension) {
      return { value: null, unit: '-', secondary: null as string | null };
    }

    if (dimension === 'mass') {
      return {
        value: costPerBase * 1000,
        unit: displayUnitByDimension[dimension],
        secondary: `Coste base interno: ${formatInternalCost(costPerBase)} €/g`,
      };
    }

    if (dimension === 'volume') {
      return {
        value: costPerBase * 1000,
        unit: displayUnitByDimension[dimension],
        secondary: `Coste base interno: ${formatInternalCost(costPerBase)} €/ml`,
      };
    }

    return {
      value: costPerBase,
      unit: displayUnitByDimension[dimension],
      secondary: null,
    };
  };

  const formatFactor = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toFixed(3);
  };

  const resolveImageUrl = (ingredient: IngredientCost) => {
    if (!ingredient.image_path) return null;
    const { data } = supabase.storage.from('cheffing-images').getPublicUrl(ingredient.image_path);
    const cacheKey = ingredient.updated_at ?? Date.now().toString();
    return `${data.publicUrl}?v=${encodeURIComponent(cacheKey)}`;
  };

  const parseWastePct = (value: string) => {
    const percentValue = Number(value);
    if (!Number.isFinite(percentValue) || percentValue < 0 || percentValue >= 100) {
      return null;
    }
    return percentValue / 100;
  };

  const startEditing = (ingredient: IngredientCost) => {
    setEditingId(ingredient.id);
    setEditingState({
      name: ingredient.name,
      purchase_unit_code: ingredient.purchase_unit_code,
      purchase_pack_qty: String(ingredient.purchase_pack_qty),
      purchase_price: formatEditableMoney(ingredient.purchase_price),
      waste_pct: String((ingredient.waste_pct * 100).toFixed(2)),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingState(null);
  };

  const saveEditing = async (ingredientId: string) => {
    if (!editingState) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const wastePctValue = parseWastePct(editingState.waste_pct);
      if (wastePctValue === null) {
        throw new Error('La merma debe estar entre 0 y 99,99%.');
      }
      const purchasePriceValue = parseEditableMoney(editingState.purchase_price);
      if (purchasePriceValue === null || purchasePriceValue < 0) {
        throw new Error('El precio del pack debe ser un número válido.');
      }

      const response = await fetch(`/api/cheffing/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingState.name,
          purchase_unit_code: editingState.purchase_unit_code,
          purchase_pack_qty: Number(editingState.purchase_pack_qty),
          purchase_price: purchasePriceValue,
          waste_pct: wastePctValue,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe un producto con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error actualizando producto');
      }

      cancelEditing();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteIngredient = async (ingredientId: string) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/cheffing/ingredients/${ingredientId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Error eliminando producto');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const indicator = (key: ProductSortKey) => {
    if (sortState.key !== key) return '↕';
    return sortState.direction === 'asc' ? '↑' : '↓';
  };

  const handleSort = (key: ProductSortKey) => {
    setSortState((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const filteredAndSortedIngredients = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchTerm);
    const filteredIngredients =
      normalizedQuery.length === 0
        ? initialIngredients
        : initialIngredients.filter((ingredient) =>
            normalizeSearchText(ingredient.name).includes(normalizedQuery),
          );

    const directionMultiplier = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredIngredients].sort((a, b) => {
      let result = 0;
      switch (sortState.key) {
        case 'name':
          result = a.name.localeCompare(b.name, 'es');
          break;
        default: {
          const aValue = a[sortState.key] ?? 0;
          const bValue = b[sortState.key] ?? 0;
          result = aValue - bValue;
          break;
        }
      }
      if (result === 0) {
        return a.name.localeCompare(b.name, 'es');
      }
      return result * directionMultiplier;
    });
  }, [initialIngredients, searchTerm, sortState]);

  const productMetrics = useMemo(() => {
    const total = initialIngredients.length;
    const withNetCost = initialIngredients.filter((ingredient) => ingredient.cost_net_per_base !== null).length;
    const withImage = initialIngredients.filter((ingredient) => Boolean(ingredient.image_path)).length;
    const purchasePackValue = initialIngredients.reduce(
      (totalValue, ingredient) => totalValue + ingredient.purchase_price,
      0,
    );

    return {
      total,
      withNetCost,
      withImage,
      purchasePackValue: purchasePackValue.toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
      }),
    };
  }, [initialIngredients]);

  return (
    <div className="space-y-4">
      <MetricStrip className="xl:grid-cols-[1fr_1fr_1fr_1.25fr]">
        <MetricCard
          label="Productos"
          value={productMetrics.total}
          description="Total en catalogo"
          tone="violet"
          icon={<ScaleIcon className="h-5 w-5" />}
          className="rounded-xl p-3"
        />
        <MetricCard
          label="Coste neto"
          value={productMetrics.withNetCost}
          description="Productos calculables"
          tone="emerald"
          icon={<CheckCircleIcon className="h-5 w-5" />}
          className="rounded-xl p-3"
        />
        <MetricCard
          label="Con imagen"
          value={productMetrics.withImage}
          description="Ficha visual completa"
          tone="sky"
          icon={<PhotoIcon className="h-5 w-5" />}
          className="rounded-xl p-3"
        />
        <MetricCard
          label="Valor packs compra"
          value={productMetrics.purchasePackValue}
          description="Suma de precios de pack"
          tone="slate"
          icon={<CurrencyEuroIcon className="h-5 w-5" />}
          className="rounded-xl p-3"
        />
      </MetricStrip>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">
          {error}
        </div>
      ) : null}

      <DataTableShell
        title="Listado de productos"
        description="Costes de compra, mermas y coste base por unidad operativa."
        toolbar={
          <Toolbar
            leading={
              <label className="relative block w-full xl:w-[420px]">
                <span className="sr-only">Buscar producto por nombre</span>
                <MagnifyingGlassIcon
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar producto por nombre"
                  className="h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950/80 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-slate-600 focus:border-primary-400/70 focus:ring-2 focus:ring-primary-500/20"
                />
              </label>
            }
            actions={
              <StatusBadge tone={searchTerm ? 'accent' : 'muted'}>
                {filteredAndSortedIngredients.length} visibles
              </StatusBadge>
            }
            className="rounded-xl bg-slate-950/40"
          />
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando {filteredAndSortedIngredients.length} de {initialIngredients.length} productos
            </span>
            <span>
              Orden: {sortLabelByKey[sortState.key]} {sortState.direction === 'asc' ? 'ascendente' : 'descendente'}
            </span>
          </div>
        }
        className="rounded-2xl"
      >
        <table className="w-full min-w-[1100px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-800/80">
              <th className="w-[31%] px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-300 transition hover:text-white"
                  onClick={() => handleSort('name')}
                >
                  Producto <span className="text-[10px] text-primary-200">{indicator('name')}</span>
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-slate-300">Imagen</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-300 transition hover:text-white"
                  onClick={() => handleSort('purchase_pack_qty')}
                >
                  Compra <span className="text-[10px] text-primary-200">{indicator('purchase_pack_qty')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-300 transition hover:text-white"
                  onClick={() => handleSort('purchase_price')}
                >
                  Precio pack <span className="text-[10px] text-primary-200">{indicator('purchase_price')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-300 transition hover:text-white"
                  onClick={() => handleSort('waste_pct')}
                >
                  Merma <span className="text-[10px] text-primary-200">{indicator('waste_pct')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-300 transition hover:text-white"
                  onClick={() => handleSort('waste_factor')}
                >
                  FC <span className="text-[10px] text-primary-200">{indicator('waste_factor')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-300 transition hover:text-white"
                  onClick={() => handleSort('cost_gross_per_base')}
                >
                  Coste bruto <span className="text-[10px] text-primary-200">{indicator('cost_gross_per_base')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-300 transition hover:text-white"
                  onClick={() => handleSort('cost_net_per_base')}
                >
                  Coste neto <span className="text-[10px] text-primary-200">{indicator('cost_net_per_base')}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/65 bg-slate-950/20">
            {initialIngredients.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay productos todavía.
                </td>
              </tr>
            ) : filteredAndSortedIngredients.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay productos que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              filteredAndSortedIngredients.map((ingredient) => {
                const isEditing = editingId === ingredient.id;
                const editingValues = isEditing ? editingState : null;
                const imageUrl = resolveImageUrl(ingredient);
                const grossDisplayCost = resolveDisplayCost(
                  ingredient.cost_gross_per_base,
                  ingredient.purchase_unit_dimension,
                );
                const netDisplayCost = resolveDisplayCost(
                  ingredient.cost_net_per_base,
                  ingredient.purchase_unit_dimension,
                );

                return (
                  <tr
                    key={ingredient.id}
                    className={cn(
                      'transition-colors hover:bg-slate-900/70',
                      isEditing ? 'bg-primary-900/20' : 'bg-transparent',
                    )}
                  >
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <input
                          aria-label="Nombre del producto"
                          className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-white outline-none focus:border-primary-400/70 focus:ring-2 focus:ring-primary-500/20"
                          value={editingValues?.name ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                          }
                        />
                      ) : (
                        <div className="min-w-0 space-y-1">
                          <Link
                            href={`/cheffing/productos/${encodeURIComponent(ingredient.id)}`}
                            className="block max-w-[34rem] truncate font-semibold text-white underline-offset-4 transition hover:text-primary-100 hover:underline"
                          >
                            {ingredient.name}
                          </Link>
                          <Link
                            href={`/cheffing/productos/${encodeURIComponent(ingredient.id)}`}
                            className="inline-flex text-xs font-semibold text-primary-200 transition hover:text-primary-100"
                          >
                            Editar ficha
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`Imagen de ${ingredient.name}`}
                          className="h-10 w-10 rounded-lg border border-slate-700/80 object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/70 text-slate-600">
                          <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Sin imagen</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-300">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label="Cantidad de compra"
                            className="w-24 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-white outline-none focus:border-primary-400/70 focus:ring-2 focus:ring-primary-500/20"
                            value={editingValues?.purchase_pack_qty ?? ''}
                            onChange={(event) =>
                              setEditingState((prev) =>
                                prev ? { ...prev, purchase_pack_qty: event.target.value } : prev,
                              )
                            }
                          />
                          <select
                            aria-label="Unidad de compra"
                            className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-white outline-none focus:border-primary-400/70 focus:ring-2 focus:ring-primary-500/20"
                            value={editingValues?.purchase_unit_code ?? ''}
                            onChange={(event) =>
                              setEditingState((prev) =>
                                prev ? { ...prev, purchase_unit_code: event.target.value } : prev,
                              )
                            }
                          >
                            {sortedUnits.map((unit) => (
                              <option key={unit.code} value={unit.code}>
                                {unit.code}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="font-medium text-slate-200">
                          {ingredient.purchase_pack_qty} {ingredient.purchase_unit_code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums text-slate-100">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label="Precio del pack"
                          className="w-24 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-white outline-none focus:border-primary-400/70 focus:ring-2 focus:ring-primary-500/20"
                          value={editingValues?.purchase_price ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) =>
                              prev ? { ...prev, purchase_price: event.target.value } : prev,
                            )
                          }
                        />
                      ) : (
                        `${ingredient.purchase_price.toFixed(2)} €`
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums text-slate-200">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          max="99.99"
                          step="0.01"
                          aria-label="Merma"
                          className="w-20 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-white outline-none focus:border-primary-400/70 focus:ring-2 focus:ring-primary-500/20"
                          value={editingValues?.waste_pct ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, waste_pct: event.target.value } : prev))
                          }
                        />
                      ) : (
                        `${(ingredient.waste_pct * 100).toFixed(1)}%`
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums text-slate-100">
                      {formatFactor(ingredient.waste_factor)}x
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums text-slate-300">
                      <div className="inline-flex items-center gap-1">
                        <span>
                          {formatDisplayCost(grossDisplayCost.value)} €/{grossDisplayCost.unit}
                        </span>
                        {grossDisplayCost.secondary ? (
                          <span className="group relative inline-flex items-center">
                            <button
                              type="button"
                              aria-label="Ver coste base interno"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white"
                            >
                              i
                            </button>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-52 rounded-md border border-slate-700 bg-slate-950/95 p-2 text-[11px] normal-case text-slate-200 opacity-0 shadow-lg shadow-slate-950/40 transition-opacity delay-700 group-hover:opacity-100 group-focus-within:opacity-100"
                            >
                              {grossDisplayCost.secondary}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums text-slate-100">
                      <div className="inline-flex items-center gap-1">
                        <span>
                          {formatDisplayCost(netDisplayCost.value)} €/{netDisplayCost.unit}
                        </span>
                        {netDisplayCost.secondary ? (
                          <span className="group relative inline-flex items-center">
                            <button
                              type="button"
                              aria-label="Ver coste base interno"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white"
                            >
                              i
                            </button>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-52 rounded-md border border-slate-700 bg-slate-950/95 p-2 text-[11px] normal-case text-slate-200 opacity-0 shadow-lg shadow-slate-950/40 transition-opacity delay-700 group-hover:opacity-100 group-focus-within:opacity-100"
                            >
                              {netDisplayCost.secondary}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditing(ingredient.id)}
                              disabled={isSubmitting}
                              className="inline-flex h-9 items-center rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-white"
                              aria-label="Cancelar edicion"
                              title="Cancelar"
                            >
                              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditing(ingredient)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/40 text-slate-300 transition hover:border-primary-400/60 hover:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                              aria-label={`Editar compra de ${ingredient.name}`}
                              title="Editar compra"
                            >
                              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteIngredient(ingredient.id)}
                              disabled={isSubmitting}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/45 bg-rose-500/10 text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Eliminar ${ingredient.name}`}
                              title="Eliminar"
                            >
                              <TrashIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
