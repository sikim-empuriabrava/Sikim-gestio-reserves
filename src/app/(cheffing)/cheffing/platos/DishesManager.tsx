'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EyeIcon,
  PencilSquareIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { DataTableShell, StatusBadge, Toolbar, cn } from '@/components/ui';
import type { Dish } from '@/lib/cheffing/types';
import { formatEditableMoney, parseEditableMoney } from '@/lib/cheffing/money';
import { normalizeSearchText } from '@/lib/cheffing/search';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { CheffingFamily } from '@/lib/cheffing/families';
import { SIN_FAMILIA_LABEL } from '@/lib/cheffing/families';
import type { DishUsageConsumer } from '@/lib/cheffing/dishUsage';
import {
  CheffingButton,
  CheffingEmptyState,
  CheffingField,
  CheffingSearchInput,
  CheffingTableActionButton,
  CheffingTableActionLink,
  cheffingEditingRowClassName,
  cheffingHeaderButtonClassName,
  cheffingInputClassName,
  cheffingNumericClassName,
  cheffingRowClassName,
  cheffingSelectClassName,
  cheffingTableClassName,
  cheffingTheadClassName,
} from '@/app/(cheffing)/cheffing/components/CheffingUi';

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

const sortLabelByKey: Record<DishSortKey, string> = {
  name: 'Nombre',
  family: 'Familia',
  selling_price: 'PVP',
  servings: 'Raciones',
  items_cost_total: 'Coste total',
  cost_per_serving: 'Coste ración',
};

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
    if (value === null || Number.isNaN(value)) return '-';
    return `${value.toFixed(2)} \u20ac`;
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
        throw new Error('El PVP debe ser un numero valido.');
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
      const confirmed = window.confirm(`Seguro que quieres eliminar este ${entityLabelSingular}?`);
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
    if (sortState.key !== key) return '<>';
    return sortState.direction === 'asc' ? '^' : 'v';
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
  const hasActiveFilters =
    Boolean(searchTerm) || selectedFamily !== 'todas' || usageFilter !== 'all' || usageScope !== 'any';

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">
          {error}
        </div>
      ) : null}

      <DataTableShell
        title={`Listado de ${entityLabelPlural}`}
        description="Coste, PVP, uso en carta y estado de escandallo."
        toolbar={
          <Toolbar
            leading={
              <CheffingSearchInput
                label={`Buscar ${entityLabelSingular} por nombre`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Buscar ${entityLabelSingular} por nombre`}
                className="w-full xl:w-[380px]"
              />
            }
            filters={
              <>
                <CheffingField label="Familia">
                  <select
                    value={selectedFamily}
                    onChange={(event) => setSelectedFamily(event.target.value)}
                    className={cheffingSelectClassName}
                  >
                    <option value="todas">Todas</option>
                    {includeFamilylessFilter ? <option value="__none__">{SIN_FAMILIA_LABEL}</option> : null}
                    {families.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.name}
                      </option>
                    ))}
                  </select>
                </CheffingField>
                <CheffingField label="Uso">
                  <select
                    value={usageFilter}
                    onChange={(event) => setUsageFilter(event.target.value as UsageFilter)}
                    className={cheffingSelectClassName}
                  >
                    <option value="all">Todos</option>
                    <option value="in_use">En uso</option>
                    <option value="unused">Sin uso</option>
                  </select>
                </CheffingField>
                <CheffingField label="Alcance">
                  <select
                    value={usageScope}
                    onChange={(event) => setUsageScope(event.target.value as UsageScope)}
                    className={cheffingSelectClassName}
                  >
                    <option value="any">Cualquier carta/menú</option>
                    <option value="active">Solo activos</option>
                  </select>
                </CheffingField>
              </>
            }
            actions={
              <StatusBadge tone={hasActiveFilters ? 'accent' : 'muted'}>
                {filteredAndSortedDishes.length} visibles
              </StatusBadge>
            }
          />
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando {filteredAndSortedDishes.length} de {initialDishes.length} {entityLabelPlural}
            </span>
            <span>
              Orden: {sortLabelByKey[sortState.key]} {sortState.direction === 'asc' ? 'ascendente' : 'descendente'}
            </span>
          </div>
        }
      >
        <table className={cn(cheffingTableClassName, 'min-w-[1210px]')}>
          <thead className={cheffingTheadClassName}>
            <tr className="border-b border-slate-800/80">
              <th className="w-[22%] px-4 py-3">
                <button type="button" className={cheffingHeaderButtonClassName} onClick={() => handleSort('name')}>
                  {firstColumnLabel} <span className="text-[10px] text-primary-200">{indicator('name')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className={cheffingHeaderButtonClassName} onClick={() => handleSort('family')}>
                  Familia <span className="text-[10px] text-primary-200">{indicator('family')}</span>
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-slate-300">Imagen</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Uso</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className={cheffingHeaderButtonClassName}
                  onClick={() => handleSort('selling_price')}
                >
                  PVP <span className="text-[10px] text-primary-200">{indicator('selling_price')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className={cheffingHeaderButtonClassName} onClick={() => handleSort('servings')}>
                  Raciones base <span className="text-[10px] text-primary-200">{indicator('servings')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className={cheffingHeaderButtonClassName}
                  onClick={() => handleSort('items_cost_total')}
                >
                  Coste total <span className="text-[10px] text-primary-200">{indicator('items_cost_total')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className={cheffingHeaderButtonClassName}
                  onClick={() => handleSort('cost_per_serving')}
                >
                  Coste ración <span className="text-[10px] text-primary-200">{indicator('cost_per_serving')}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
            {initialDishes.length === 0 ? (
              <CheffingEmptyState
                colSpan={9}
                title={`No hay ${entityLabelPlural} todavia.`}
                description={`Crea un ${entityLabelSingular} para calcular coste y uso.`}
              />
            ) : filteredAndSortedDishes.length === 0 ? (
              <CheffingEmptyState
                colSpan={9}
                title={`No hay ${entityLabelPlural} para el filtro actual.`}
                description="Ajusta búsqueda, familia o uso para ampliar resultados."
              />
            ) : (
              filteredAndSortedDishes.map((dish) => {
                const isEditing = editingId === dish.id;
                const editingValues = isEditing ? editingState : null;
                const imageUrl = resolveImageUrl(dish);

                return (
                  <tr key={dish.id} className={cn(cheffingRowClassName, isEditing && cheffingEditingRowClassName)}>
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <input
                          aria-label={`Nombre de ${entityLabelSingular}`}
                          className={cheffingInputClassName}
                          value={editingValues?.name ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                          }
                        />
                      ) : (
                        <Link
                          href={`${basePath}/${dish.id}`}
                          className="font-semibold text-white underline-offset-4 transition hover:text-primary-100 hover:underline"
                        >
                          {dish.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-300">
                      {isEditing ? (
                        <select
                          aria-label="Familia"
                          className={cheffingSelectClassName}
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
                    <td className="px-4 py-3 align-middle">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`Imagen de ${dish.name}`}
                          className="h-10 w-10 rounded-lg border border-slate-700/80 object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/70 text-slate-600">
                          <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Sin imagen</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {dish.usage_has_any ? (
                        <div className="group relative inline-flex">
                          <StatusBadge tone={dish.usage_has_active ? 'success' : 'info'}>En uso</StatusBadge>
                          <div
                            role="tooltip"
                            className="absolute left-0 top-full z-20 mt-2 hidden w-80 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-left text-[11px] normal-case text-slate-200 shadow-xl shadow-slate-950/40 group-hover:block group-focus-within:block"
                          >
                            <div className="space-y-2">
                              <div>
                                <p className="font-semibold text-slate-100">Cartas</p>
                                {dish.usage_cards && dish.usage_cards.length > 0 ? (
                                  <ul className="mt-1 space-y-1">
                                    {dish.usage_cards.map((card) => (
                                      <li key={card.id} className="flex items-center justify-between gap-2">
                                        <Link
                                          href={`/cheffing/carta/${card.id}`}
                                          className="text-slate-300 underline-offset-2 transition hover:text-primary-100 hover:underline"
                                        >
                                          {card.name}
                                        </Link>
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
                                <p className="font-semibold text-slate-100">Menus</p>
                                {dish.usage_menus && dish.usage_menus.length > 0 ? (
                                  <ul className="mt-1 space-y-1">
                                    {dish.usage_menus.map((menu) => (
                                      <li key={menu.id} className="flex items-center justify-between gap-2">
                                        <Link
                                          href={`/cheffing/menus/${menu.id}`}
                                          className="text-slate-300 underline-offset-2 transition hover:text-primary-100 hover:underline"
                                        >
                                          {menu.name}
                                        </Link>
                                        <span className={menu.is_active ? 'text-emerald-300' : 'text-slate-400'}>
                                          {menu.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-slate-500">Sin menus</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <StatusBadge tone="muted">Sin uso</StatusBadge>
                      )}
                    </td>
                    <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label="PVP"
                          className={cn(cheffingInputClassName, 'w-32')}
                          value={editingValues?.selling_price ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, selling_price: event.target.value } : prev))
                          }
                        />
                      ) : (
                        formatCurrency(dish.selling_price)
                      )}
                    </td>
                    <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          aria-label="Raciones base"
                          className={cn(cheffingInputClassName, 'w-20')}
                          value={editingValues?.servings ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, servings: event.target.value } : prev))
                          }
                        />
                      ) : (
                        dish.servings
                      )}
                    </td>
                    <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                      {formatCurrency(dish.items_cost_total)}
                    </td>
                    <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                      {formatCurrency(dish.cost_per_serving ?? null)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <CheffingButton
                              type="button"
                              tone="success"
                              onClick={() => saveEditing(dish.id)}
                              disabled={isSubmitting}
                            >
                              Guardar
                            </CheffingButton>
                            <CheffingTableActionButton
                              type="button"
                              onClick={cancelEditing}
                              aria-label="Cancelar edicion"
                              title="Cancelar"
                            >
                              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            </CheffingTableActionButton>
                          </>
                        ) : (
                          <>
                            <CheffingTableActionLink href={`${basePath}/${dish.id}`}>
                              <EyeIcon className="h-4 w-4" aria-hidden="true" />
                              Ver
                            </CheffingTableActionLink>
                            <CheffingTableActionButton type="button" onClick={() => startEditing(dish)}>
                              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                              Editar
                            </CheffingTableActionButton>
                            <CheffingTableActionButton
                              type="button"
                              tone="danger"
                              onClick={() => deleteDish(dish.id)}
                              disabled={isSubmitting}
                            >
                              <TrashIcon className="h-4 w-4" aria-hidden="true" />
                              Eliminar
                            </CheffingTableActionButton>
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
