'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { Dish } from '@/lib/cheffing/types';
import { formatEditableMoney, parseEditableMoney } from '@/lib/cheffing/money';
import { normalizeSearchText } from '@/lib/cheffing/search';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { CheffingFamily } from '@/lib/cheffing/families';
import { SIN_FAMILIA_LABEL } from '@/lib/cheffing/families';
import type { DishUsageConsumer } from '@/lib/cheffing/dishUsage';

export type DishCost = Dish & {
  items_cost_total: number | null;
  cost_per_serving?: number | null;
  family_name?: string | null;
  usage_cards?: DishUsageConsumer[];
  usage_menus?: DishUsageConsumer[];
  usage_has_any?: boolean;
  usage_has_active?: boolean;
};

type DishesManagerProps = {
  initialDishes: DishCost[];
  families: CheffingFamily[];
  basePath?: '/cheffing/platos' | '/cheffing/bebidas';
  entityLabelSingular?: string;
  entityLabelPlural?: string;
  includeFamilylessFilter?: boolean;
};

type DishFormState = {
  name: string;
  selling_price: string;
  servings: string;
  family_id: string;
};

type SortDirection = 'asc' | 'desc';
type DishSortKey = 'name' | 'family' | 'selling_price' | 'servings' | 'items_cost_total' | 'cost_per_serving';
type UsageFilter = 'all' | 'in_use' | 'unused';
type UsageScope = 'any' | 'active';

export function DishesManager({
  initialDishes,
  families,
  basePath = '/cheffing/platos',
  entityLabelSingular = 'plato',
  entityLabelPlural = 'platos',
  includeFamilylessFilter = true,
}: DishesManagerProps) {
  const capitalizeFirstLetter = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<DishFormState | null>(null);
  const [selectedFamily, setSelectedFamily] = useState('todas');
  const [usageFilter, setUsageFilter] = useState<UsageFilter>('all');
  const [usageScope, setUsageScope] = useState<UsageScope>('any');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortState, setSortState] = useState<{ key: DishSortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const formatCurrency = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

  const resolveImageUrl = (dish: DishCost) => {
    if (!dish.image_path) return null;
    const { data } = supabase.storage.from('cheffing-images').getPublicUrl(dish.image_path);
    const cacheKey = dish.updated_at ?? Date.now().toString();
    return `${data.publicUrl}?v=${encodeURIComponent(cacheKey)}`;
  };

  const startEditing = (dish: DishCost) => {
    setEditingId(dish.id);
    setEditingState({
      name: dish.name,
      selling_price: formatEditableMoney(dish.selling_price),
      servings: String(dish.servings ?? 1),
      family_id: dish.family_id ?? '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingState(null);
  };

  const saveEditing = async (dishId: string) => {
    if (!editingState) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const sellingPriceValue = parseEditableMoney(editingState.selling_price);
      const servingsValue = Number(editingState.servings);

      if (sellingPriceValue !== null && sellingPriceValue < 0) {
        throw new Error('El PVP debe ser un número válido.');
      }

      if (!Number.isFinite(servingsValue) || servingsValue <= 0) {
        throw new Error('Las raciones deben ser mayores que 0.');
      }

      const response = await fetch(`/api/cheffing/dishes/${dishId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingState.name,
          selling_price: sellingPriceValue,
          servings: servingsValue,
          family_id: editingState.family_id || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error(`Ya existe un ${entityLabelSingular} con ese nombre.`);
        }
        throw new Error(payload?.error ?? `Error actualizando ${entityLabelSingular}`);
      }

      cancelEditing();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteDish = async (dishId: string) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const confirmed = window.confirm(`¿Seguro que quieres eliminar este ${entityLabelSingular}?`);
      if (!confirmed) {
        return;
      }
      const response = await fetch(`/api/cheffing/dishes/${dishId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? `Error eliminando ${entityLabelSingular}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const indicator = (key: DishSortKey) => {
    if (sortState.key !== key) return '↕';
    return sortState.direction === 'asc' ? '↑' : '↓';
  };

  const handleSort = (key: DishSortKey) => {
    setSortState((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const filteredAndSortedDishes = useMemo(() => {
    const familyFilteredDishes =
      selectedFamily === 'todas'
        ? initialDishes
        : selectedFamily === '__none__' && includeFamilylessFilter
          ? initialDishes.filter((dish) => !dish.family_id)
          : initialDishes.filter((dish) => dish.family_id === selectedFamily);
    const normalizedQuery = normalizeSearchText(searchTerm);
    const textFilteredDishes =
      normalizedQuery.length === 0
        ? familyFilteredDishes
        : familyFilteredDishes.filter((dish) => normalizeSearchText(dish.name).includes(normalizedQuery));
    const usageFilteredDishes =
      usageFilter === 'all'
        ? textFilteredDishes
        : textFilteredDishes.filter((dish) => {
            const inUse = usageScope === 'active' ? (dish.usage_has_active ?? false) : (dish.usage_has_any ?? false);
            return usageFilter === 'in_use' ? inUse : !inUse;
          });

    const directionMultiplier = sortState.direction === 'asc' ? 1 : -1;
    return [...usageFilteredDishes].sort((a, b) => {
      let result = 0;
      switch (sortState.key) {
        case 'name':
          result = a.name.localeCompare(b.name, 'es');
          break;
        case 'family':
          result = (a.family_name ?? SIN_FAMILIA_LABEL).localeCompare(b.family_name ?? SIN_FAMILIA_LABEL, 'es');
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
  }, [includeFamilylessFilter, initialDishes, searchTerm, selectedFamily, sortState, usageFilter, usageScope]);
  const firstColumnLabel = capitalizeFirstLetter(entityLabelSingular);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`${basePath}/new`}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
        >
          Nuevo {entityLabelSingular}
        </Link>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>Familia</span>
          <select
            value={selectedFamily}
            onChange={(event) => setSelectedFamily(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
          >
            <option value="todas">Todas</option>
            {includeFamilylessFilter ? <option value="__none__">{SIN_FAMILIA_LABEL}</option> : null}
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>Uso</span>
          <select
            value={usageFilter}
            onChange={(event) => setUsageFilter(event.target.value as UsageFilter)}
            className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
          >
            <option value="all">Todos</option>
            <option value="in_use">En uso</option>
            <option value="unused">Sin uso</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>Alcance</span>
          <select
            value={usageScope}
            onChange={(event) => setUsageScope(event.target.value as UsageScope)}
            className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
          >
            <option value="any">Cualquier carta/menú</option>
            <option value="active">Solo activos</option>
          </select>
        </label>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={`Buscar ${entityLabelSingular} por nombre`}
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[1210px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('name')}>
                  {firstColumnLabel} <span className="text-[10px]">{indicator('name')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('family')}>
                  Familia <span className="text-[10px]">{indicator('family')}</span>
                </button>
              </th>
              <th className="px-4 py-3">Imagen</th>
              <th className="px-4 py-3">Uso</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => handleSort('selling_price')}
                >
                  PVP <span className="text-[10px]">{indicator('selling_price')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('servings')}>
                  Raciones base <span className="text-[10px]">{indicator('servings')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => handleSort('items_cost_total')}
                >
                  Coste total <span className="text-[10px]">{indicator('items_cost_total')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => handleSort('cost_per_serving')}
                >
                  Coste ración <span className="text-[10px]">{indicator('cost_per_serving')}</span>
                </button>
              </th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialDishes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay {entityLabelPlural} todavía.
                </td>
              </tr>
            ) : filteredAndSortedDishes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay {entityLabelPlural} que coincidan con el filtro actual.
                </td>
              </tr>
            ) : (
              filteredAndSortedDishes.map((dish) => {
                const isEditing = editingId === dish.id;
                const editingValues = isEditing ? editingState : null;
                const imageUrl = resolveImageUrl(dish);

                return (
                  <tr key={dish.id} className="border-t border-slate-800/60">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                          value={editingValues?.name ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                          }
                        />
                      ) : (
                        <Link href={`${basePath}/${dish.id}`} className="font-semibold text-white">
                          {dish.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {isEditing ? (
                        <select
                          className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                          value={editingValues?.family_id ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, family_id: event.target.value } : prev))
                          }
                        >
                          <option value="">{SIN_FAMILIA_LABEL}</option>
                          {families.map((family) => (
                            <option key={family.id} value={family.id}>
                              {family.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        dish.family_name ?? SIN_FAMILIA_LABEL
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`Imagen de ${dish.name}`}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {dish.usage_has_any ? (
                        <div className="group relative inline-flex">
                          <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
                            En uso
                          </span>
                          <div
                            role="tooltip"
                            className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-80 rounded-md border border-slate-700 bg-slate-950/95 p-3 text-left text-[11px] normal-case text-slate-200 shadow-lg group-hover:block group-focus-within:block"
                          >
                            <div className="space-y-2">
                              <div>
                                <p className="font-semibold text-slate-100">Cartas</p>
                                {dish.usage_cards && dish.usage_cards.length > 0 ? (
                                  <ul className="mt-1 space-y-1">
                                    {dish.usage_cards.map((card) => (
                                      <li key={card.id} className="flex items-center justify-between gap-2">
                                        <span className="text-slate-300">{card.name}</span>
                                        <span className={card.is_active ? 'text-emerald-300' : 'text-slate-400'}>
                                          {card.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-slate-500">Sin cartas</p>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-100">Menús</p>
                                {dish.usage_menus && dish.usage_menus.length > 0 ? (
                                  <ul className="mt-1 space-y-1">
                                    {dish.usage_menus.map((menu) => (
                                      <li key={menu.id} className="flex items-center justify-between gap-2">
                                        <span className="text-slate-300">{menu.name}</span>
                                        <span className={menu.is_active ? 'text-emerald-300' : 'text-slate-400'}>
                                          {menu.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-slate-500">Sin menús</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">Sin uso</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-32 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                          value={editingValues?.selling_price ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, selling_price: event.target.value } : prev))
                          }
                        />
                      ) : (
                        formatCurrency(dish.selling_price)
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="w-20 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                          value={editingValues?.servings ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, servings: event.target.value } : prev))
                          }
                        />
                      ) : (
                        dish.servings
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-100">
                      {formatCurrency(dish.items_cost_total)}
                    </td>
                    <td className="px-4 py-3 text-slate-100">
                      {formatCurrency(dish.cost_per_serving ?? null)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditing(dish.id)}
                              disabled={isSubmitting}
                              className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-200"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              href={`${basePath}/${dish.id}`}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                            >
                              Ver
                            </Link>
                            <button
                              type="button"
                              onClick={() => startEditing(dish)}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDish(dish.id)}
                              disabled={isSubmitting}
                              className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200"
                            >
                              Eliminar
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
      </div>
    </div>
  );
}
