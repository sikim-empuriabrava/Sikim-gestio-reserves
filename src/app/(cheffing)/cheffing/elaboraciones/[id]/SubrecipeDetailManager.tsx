'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { Ingredient, Subrecipe, SubrecipeItem, Unit, UnitDimension } from '@/lib/cheffing/types';
import { CheffingItemPicker } from '@/app/(cheffing)/cheffing/components/CheffingItemPicker';

export type SubrecipeCost = Subrecipe & {
  output_unit_dimension: UnitDimension | null;
  output_unit_factor: number | null;
  items_cost_total: number | null;
  cost_gross_per_base: number | null;
  cost_net_per_base: number | null;
  waste_factor: number | null;
};

export type SubrecipeItemWithDetails = SubrecipeItem & {
  ingredient?: { id: string; name: string } | null;
  subrecipe_component?: { id: string; name: string } | null;
  line_cost_total?: number | null;
};

type SubrecipeDetailManagerProps = {
  subrecipe: SubrecipeCost;
  items: SubrecipeItemWithDetails[];
  ingredients: Ingredient[];
  subrecipes: Subrecipe[];
  units: Unit[];
};

type SubrecipeFormState = {
  name: string;
  output_unit_code: string;
  output_qty: string;
  waste_pct: string;
  notes: string;
};

type ItemFormState = {
  itemType: 'ingredient' | 'subrecipe';
  ingredient_id: string;
  subrecipe_component_id: string;
  unit_code: string;
  quantity: string;
  waste_pct: string;
  notes: string;
};

export function SubrecipeDetailManager({
  subrecipe,
  items,
  ingredients,
  subrecipes,
  units,
}: SubrecipeDetailManagerProps) {
  const router = useRouter();
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemState, setEditingItemState] = useState<ItemFormState | null>(null);
  const [formState, setFormState] = useState<SubrecipeFormState>({
    name: subrecipe.name,
    output_unit_code: subrecipe.output_unit_code,
    output_qty: String(subrecipe.output_qty),
    waste_pct: String((subrecipe.waste_pct * 100).toFixed(2)),
    notes: subrecipe.notes ?? '',
  });

  const subrecipeOptions = useMemo(() => {
    return subrecipes.filter((entry) => entry.id !== subrecipe.id);
  }, [subrecipe.id, subrecipes]);

  const parseWastePct = (value: string) => {
    const percentValue = Number(value);
    if (!Number.isFinite(percentValue) || percentValue < 0 || percentValue >= 100) {
      return null;
    }
    return percentValue / 100;
  };

  const ensureValidQuantity = (value: string) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }
    return numericValue;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toFixed(4);
  };

  const saveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHeaderError(null);
    setIsSubmitting(true);

    try {
      const outputQtyValue = ensureValidQuantity(formState.output_qty);
      if (outputQtyValue === null) {
        throw new Error('La producción debe ser mayor que 0.');
      }

      const wastePctValue = parseWastePct(formState.waste_pct);
      if (wastePctValue === null) {
        throw new Error('La merma debe estar entre 0 y 99,99%.');
      }

      const response = await fetch(`/api/cheffing/subrecipes/${subrecipe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          output_unit_code: formState.output_unit_code,
          output_qty: outputQtyValue,
          waste_pct: wastePctValue,
          notes: formState.notes.trim() ? formState.notes.trim() : null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe una elaboración con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error actualizando elaboración');
      }

      router.refresh();
      // TODO: Auto-select the newly added line for editing once we can identify it reliably.
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSubrecipe = async () => {
    setHeaderError(null);
    setIsSubmitting(true);

    try {
      const confirmed = window.confirm('¿Seguro que quieres eliminar esta elaboración?');
      if (!confirmed) {
        return;
      }
      const response = await fetch(`/api/cheffing/subrecipes/${subrecipe.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Error eliminando elaboración');
      }

      router.push('/cheffing/elaboraciones');
      router.refresh();
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addItem = async ({ type, id, unitCode }: { type: 'ingredient' | 'subrecipe'; id: string; unitCode: string }) => {
    setItemsError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/cheffing/subrecipes/${subrecipe.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: type === 'ingredient' ? id : null,
          subrecipe_component_id: type === 'subrecipe' ? id : null,
          unit_code: unitCode,
          quantity: 1,
          waste_pct: 0,
          notes: null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error(payload?.error ?? 'Esta línea ya existe en la elaboración.');
        }
        throw new Error(payload?.error ?? 'Error creando línea');
      }

      router.refresh();
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditingItem = (item: SubrecipeItemWithDetails) => {
    const isIngredient = Boolean(item.ingredient_id);
    setEditingItemId(item.id);
    setEditingItemState({
      itemType: isIngredient ? 'ingredient' : 'subrecipe',
      ingredient_id: item.ingredient_id ?? ingredients[0]?.id ?? '',
      subrecipe_component_id: item.subrecipe_component_id ?? subrecipeOptions[0]?.id ?? '',
      unit_code: item.unit_code,
      quantity: String(item.quantity),
      waste_pct: String((item.waste_pct * 100).toFixed(2)),
      notes: item.notes ?? '',
    });
  };

  const cancelEditingItem = () => {
    setEditingItemId(null);
    setEditingItemState(null);
  };

  const saveEditingItem = async (itemId: string) => {
    if (!editingItemState) return;
    setItemsError(null);
    setIsSubmitting(true);

    try {
      const quantityValue = ensureValidQuantity(editingItemState.quantity);
      if (quantityValue === null) {
        throw new Error('La cantidad debe ser mayor que 0.');
      }

      const wastePctValue = parseWastePct(editingItemState.waste_pct);
      if (wastePctValue === null) {
        throw new Error('La merma debe estar entre 0 y 99,99%.');
      }

      const ingredientId = editingItemState.itemType === 'ingredient' ? editingItemState.ingredient_id : null;
      const subrecipeComponentId =
        editingItemState.itemType === 'subrecipe' ? editingItemState.subrecipe_component_id : null;

      if (editingItemState.itemType === 'ingredient' && !ingredientId) {
        throw new Error('Selecciona un ingrediente válido.');
      }
      if (editingItemState.itemType === 'subrecipe' && !subrecipeComponentId) {
        throw new Error('Selecciona una elaboración válida.');
      }

      const response = await fetch(`/api/cheffing/subrecipes/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: ingredientId,
          subrecipe_component_id: subrecipeComponentId,
          unit_code: editingItemState.unit_code,
          quantity: quantityValue,
          waste_pct: wastePctValue,
          notes: editingItemState.notes.trim() ? editingItemState.notes.trim() : null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error(payload?.error ?? 'Esta línea ya existe en la elaboración.');
        }
        throw new Error(payload?.error ?? 'Error actualizando línea');
      }

      cancelEditingItem();
      router.refresh();
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    setItemsError(null);
    setIsSubmitting(true);

    try {
      const confirmed = window.confirm('¿Seguro que quieres eliminar esta línea?');
      if (!confirmed) {
        return;
      }
      const response = await fetch(`/api/cheffing/subrecipes/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Error eliminando línea');
      }

      router.refresh();
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={saveHeader}
        className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Elaboración</p>
            <h2 className="text-xl font-semibold text-white">{subrecipe.name}</h2>
          </div>
          <div className="text-right text-sm text-slate-300">
            <p>Coste total: {formatCurrency(subrecipe.items_cost_total)} €</p>
            <p>Coste neto base: {formatCurrency(subrecipe.cost_net_per_base)} €</p>
          </div>
        </div>
        {headerError ? <p className="text-sm text-rose-400">{headerError}</p> : null}
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Nombre
            <input
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Producción
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-28 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                value={formState.output_qty}
                onChange={(event) => setFormState((prev) => ({ ...prev, output_qty: event.target.value }))}
                required
              />
              <select
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                value={formState.output_unit_code}
                onChange={(event) => setFormState((prev) => ({ ...prev, output_unit_code: event.target.value }))}
              >
                {units.map((unit) => (
                  <option key={unit.code} value={unit.code}>
                    {unit.code} · {unit.name ?? unit.code}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Merma (%)
            <input
              type="number"
              min="0"
              max="99.99"
              step="0.01"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.waste_pct}
              onChange={(event) => setFormState((prev) => ({ ...prev, waste_pct: event.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-4">
            Notas
            <textarea
              rows={3}
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.notes}
              onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar cambios
          </button>
          <button
            type="button"
            onClick={deleteSubrecipe}
            disabled={isSubmitting}
            className="rounded-full border border-rose-500/70 px-4 py-2 text-sm font-semibold text-rose-200"
          >
            Eliminar elaboración
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Ingredientes y elaboraciones</h3>
            <p className="text-sm text-slate-400">Añade líneas de coste para esta elaboración.</p>
          </div>
          {itemsError ? <p className="text-sm text-rose-400">{itemsError}</p> : null}
        </div>
        <CheffingItemPicker
          ingredients={ingredients}
          subrecipes={subrecipeOptions}
          units={units}
          ingredientNewHref="/cheffing/ingredientes/new"
          subrecipeNewHref="/cheffing/elaboraciones/new"
          mode="recipe"
          isSubmitting={isSubmitting}
          onAddItem={addItem}
        >
          <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
            <table className="w-full min-w-[960px] text-left text-sm text-slate-200">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Detalle</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Merma</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3">Coste</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    Añade ingredientes o elaboraciones para calcular el coste.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isEditing = editingItemId === item.id;
                  const editingValues = isEditing ? editingItemState : null;
                  const itemType = item.ingredient_id ? 'Ingrediente' : 'Elaboración';
                  const itemName = item.ingredient?.name ?? item.subrecipe_component?.name ?? '—';
                  const itemLink = item.ingredient_id
                    ? '/cheffing/ingredientes'
                    : item.subrecipe_component_id
                      ? `/cheffing/elaboraciones/${item.subrecipe_component_id}`
                      : '#';

                  return (
                    <tr key={item.id} className="border-t border-slate-800/60">
                      <td className="px-4 py-3">{itemType}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                              <select
                                className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                                value={editingValues?.itemType ?? 'ingredient'}
                                onChange={(event) =>
                                  setEditingItemState((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          itemType: event.target.value as ItemFormState['itemType'],
                                          ingredient_id:
                                            event.target.value === 'ingredient'
                                              ? (prev.ingredient_id || ingredients[0]?.id) ?? ''
                                              : '',
                                          subrecipe_component_id:
                                            event.target.value === 'subrecipe'
                                              ? (prev.subrecipe_component_id || subrecipeOptions[0]?.id) ?? ''
                                              : '',
                                        }
                                      : prev,
                                  )
                                }
                              >
                              <option value="ingredient">Ingrediente</option>
                              <option value="subrecipe">Elaboración</option>
                            </select>
                            {editingValues?.itemType === 'ingredient' ? (
                              <select
                                className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                                value={editingValues.ingredient_id}
                                onChange={(event) =>
                                  setEditingItemState((prev) =>
                                    prev ? { ...prev, ingredient_id: event.target.value } : prev,
                                  )
                                }
                              >
                                {ingredients.map((ingredient) => (
                                  <option key={ingredient.id} value={ingredient.id}>
                                    {ingredient.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                                value={editingValues?.subrecipe_component_id ?? ''}
                                onChange={(event) =>
                                  setEditingItemState((prev) =>
                                    prev ? { ...prev, subrecipe_component_id: event.target.value } : prev,
                                  )
                                }
                              >
                                {subrecipeOptions.map((entry) => (
                                  <option key={entry.id} value={entry.id}>
                                    {entry.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <Link href={itemLink} className="font-semibold text-white">
                            {itemName}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                              value={editingValues?.quantity ?? ''}
                              onChange={(event) =>
                                setEditingItemState((prev) =>
                                  prev ? { ...prev, quantity: event.target.value } : prev,
                                )
                              }
                            />
                            <select
                              className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                              value={editingValues?.unit_code ?? ''}
                              onChange={(event) =>
                                setEditingItemState((prev) =>
                                  prev ? { ...prev, unit_code: event.target.value } : prev,
                                )
                              }
                            >
                              {units.map((unit) => (
                                <option key={unit.code} value={unit.code}>
                                  {unit.code}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          `${item.quantity} ${item.unit_code}`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="99.99"
                            step="0.01"
                            className="w-20 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                            value={editingValues?.waste_pct ?? ''}
                            onChange={(event) =>
                              setEditingItemState((prev) =>
                                prev ? { ...prev, waste_pct: event.target.value } : prev,
                              )
                            }
                          />
                        ) : (
                          `${(item.waste_pct * 100).toFixed(2)}%`
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {isEditing ? (
                          <input
                            className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                            value={editingValues?.notes ?? ''}
                            onChange={(event) =>
                              setEditingItemState((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                            }
                          />
                        ) : (
                          item.notes ?? '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-100">
                        {formatCurrency(item.line_cost_total ?? null)} €
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEditingItem(item.id)}
                                disabled={isSubmitting}
                                className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-200"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingItem}
                                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditingItem(item)}
                                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem(item.id)}
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
        </CheffingItemPicker>
      </div>
    </div>
  );
}
