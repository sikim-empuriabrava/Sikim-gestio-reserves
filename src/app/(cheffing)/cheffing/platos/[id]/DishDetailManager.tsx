'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { Dish, DishItem, Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';
import { CheffingItemPicker } from '@/app/(cheffing)/cheffing/components/CheffingItemPicker';
import { AllergensIndicatorsPicker } from '@/app/(cheffing)/cheffing/components/AllergensIndicatorsPicker';
import { ImageUploader } from '@/app/(cheffing)/cheffing/components/ImageUploader';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { toAllergenKeys, toIndicatorKeys } from '@/lib/cheffing/allergensHelpers';

export type DishCost = Dish & {
  items_cost_total: number | null;
  cost_per_serving?: number | null;
};

export type DishItemWithDetails = DishItem & {
  ingredient?: { id: string; name: string } | null;
  subrecipe?: { id: string; name: string } | null;
  line_cost_total?: number | null;
};

type DishDetailManagerProps = {
  dish: DishCost;
  items: DishItemWithDetails[];
  ingredients: Ingredient[];
  subrecipes: Subrecipe[];
  units: Unit[];
};

type DishFormState = {
  name: string;
  selling_price: string;
  servings: string;
  notes: string;
};

type ItemFormState = {
  itemType: 'ingredient' | 'subrecipe';
  ingredient_id: string;
  subrecipe_id: string;
  unit_code: string;
  quantity: string;
  waste_pct: string;
  notes: string;
};

export function DishDetailManager({ dish, items, ingredients, subrecipes, units }: DishDetailManagerProps) {
  const router = useRouter();
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemState, setEditingItemState] = useState<ItemFormState | null>(null);
  const [manualAddAllergens, setManualAddAllergens] = useState<string[]>(
    dish.allergens_manual_add ?? [],
  );
  const [manualExcludeAllergens, setManualExcludeAllergens] = useState<string[]>(
    dish.allergens_manual_exclude ?? [],
  );
  const [manualAddIndicators, setManualAddIndicators] = useState<string[]>(
    dish.indicators_manual_add ?? [],
  );
  const [manualExcludeIndicators, setManualExcludeIndicators] = useState<string[]>(
    dish.indicators_manual_exclude ?? [],
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formState, setFormState] = useState<DishFormState>({
    name: dish.name,
    selling_price: dish.selling_price === null ? '' : String(dish.selling_price),
    servings: String(dish.servings ?? 1),
    notes: dish.notes ?? '',
  });

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const ingredientsById = useMemo(() => {
    return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  }, [ingredients]);

  const subrecipesById = useMemo(() => {
    return new Map(subrecipes.map((entry) => [entry.id, entry]));
  }, [subrecipes]);

  const inheritedAllergens = useMemo(() => {
    const inherited = new Set<string>();
    items.forEach((item) => {
      if (item.ingredient_id) {
        const ingredient = ingredientsById.get(item.ingredient_id);
        ingredient?.allergens?.forEach((key) => inherited.add(key));
      } else if (item.subrecipe_id) {
        const subrecipe = subrecipesById.get(item.subrecipe_id);
        subrecipe?.effective_allergens?.forEach((key) => inherited.add(key));
      }
    });
    return Array.from(inherited);
  }, [items, ingredientsById, subrecipesById]);

  const inheritedIndicators = useMemo(() => {
    const inherited = new Set<string>();
    items.forEach((item) => {
      if (item.ingredient_id) {
        const ingredient = ingredientsById.get(item.ingredient_id);
        ingredient?.indicators?.forEach((key) => inherited.add(key));
      } else if (item.subrecipe_id) {
        const subrecipe = subrecipesById.get(item.subrecipe_id);
        subrecipe?.effective_indicators?.forEach((key) => inherited.add(key));
      }
    });
    return Array.from(inherited);
  }, [items, ingredientsById, subrecipesById]);

  const existingImageUrl = useMemo(() => {
    if (!dish.image_path) return null;
    const { data } = supabase.storage.from('cheffing-images').getPublicUrl(dish.image_path);
    return data.publicUrl;
  }, [dish.image_path, supabase]);

  const formatCurrency = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

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

  const saveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHeaderError(null);
    setIsSubmitting(true);

    try {
      const sellingPriceValue = formState.selling_price.trim() === '' ? null : Number(formState.selling_price);
      const servingsValue = Number(formState.servings);

      if (sellingPriceValue !== null && (!Number.isFinite(sellingPriceValue) || sellingPriceValue < 0)) {
        throw new Error('El PVP debe ser un número válido.');
      }

      if (!Number.isFinite(servingsValue) || servingsValue <= 0) {
        throw new Error('Las raciones deben ser mayores que 0.');
      }

      let newImagePath: string | null = dish.image_path ?? null;
      let uploadedPath: string | null = null;

      if (imageFile) {
        const extension = imageFile.type === 'image/webp' ? 'webp' : 'jpg';
        const filename = `${crypto.randomUUID()}.${extension}`;
        const prefix = dish.venue_id ? `${dish.venue_id}/` : '';
        const path = `${prefix}dishes/${dish.id}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from('cheffing-images')
          .upload(path, imageFile, { upsert: true, contentType: imageFile.type });

        if (uploadError) {
          throw new Error('Error subiendo la imagen del plato.');
        }

        newImagePath = path;
        uploadedPath = path;
      }

      const response = await fetch(`/api/cheffing/dishes/${dish.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          selling_price: sellingPriceValue,
          servings: servingsValue,
          notes: formState.notes.trim() ? formState.notes.trim() : null,
          allergens_manual_add: Array.from(new Set(toAllergenKeys(manualAddAllergens))),
          allergens_manual_exclude: Array.from(new Set(toAllergenKeys(manualExcludeAllergens))),
          indicators_manual_add: Array.from(new Set(toIndicatorKeys(manualAddIndicators))),
          indicators_manual_exclude: Array.from(new Set(toIndicatorKeys(manualExcludeIndicators))),
          image_path: newImagePath,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe un plato con ese nombre.');
        }
        if (uploadedPath) {
          await supabase.storage.from('cheffing-images').remove([uploadedPath]);
        }
        throw new Error(payload?.error ?? 'Error actualizando plato');
      }

      if (uploadedPath && dish.image_path && dish.image_path !== uploadedPath) {
        await supabase.storage.from('cheffing-images').remove([dish.image_path]);
      }

      setImageFile(null);
      router.refresh();
      // TODO: Auto-select the newly added line for editing once we can identify it reliably.
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteDish = async () => {
    setHeaderError(null);
    setIsSubmitting(true);

    try {
      const confirmed = window.confirm('¿Seguro que quieres eliminar este plato?');
      if (!confirmed) {
        return;
      }
      const response = await fetch(`/api/cheffing/dishes/${dish.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Error eliminando plato');
      }

      router.push('/cheffing/platos');
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
      const response = await fetch(`/api/cheffing/dishes/${dish.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: type === 'ingredient' ? id : null,
          subrecipe_id: type === 'subrecipe' ? id : null,
          unit_code: unitCode,
          quantity: 1,
          waste_pct: 0,
          notes: null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error(payload?.error ?? 'Esta línea ya existe en el plato.');
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

  const startEditingItem = (item: DishItemWithDetails) => {
    const isIngredient = Boolean(item.ingredient_id);
    setEditingItemId(item.id);
    setEditingItemState({
      itemType: isIngredient ? 'ingredient' : 'subrecipe',
      ingredient_id: item.ingredient_id ?? ingredients[0]?.id ?? '',
      subrecipe_id: item.subrecipe_id ?? subrecipes[0]?.id ?? '',
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
      const subrecipeId = editingItemState.itemType === 'subrecipe' ? editingItemState.subrecipe_id : null;

      if (editingItemState.itemType === 'ingredient' && !ingredientId) {
        throw new Error('Selecciona un ingrediente válido.');
      }
      if (editingItemState.itemType === 'subrecipe' && !subrecipeId) {
        throw new Error('Selecciona una elaboración válida.');
      }

      const response = await fetch(`/api/cheffing/dishes/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: ingredientId,
          subrecipe_id: subrecipeId,
          unit_code: editingItemState.unit_code,
          quantity: quantityValue,
          waste_pct: wastePctValue,
          notes: editingItemState.notes.trim() ? editingItemState.notes.trim() : null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error(payload?.error ?? 'Esta línea ya existe en el plato.');
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
      const response = await fetch(`/api/cheffing/dishes/items/${itemId}`, {
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
            <p className="text-xs uppercase text-slate-500">Plato</p>
            <h2 className="text-xl font-semibold text-white">{dish.name}</h2>
          </div>
          <div className="text-right text-sm text-slate-300">
            <p>Coste total: {formatCurrency(dish.items_cost_total)}</p>
            <p>Coste ración: {formatCurrency(dish.cost_per_serving ?? null)}</p>
          </div>
        </div>
        {headerError ? <p className="text-sm text-rose-400">{headerError}</p> : null}
        <div className="grid gap-4 md:grid-cols-3">
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
            PVP (€)
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.selling_price}
              onChange={(event) => setFormState((prev) => ({ ...prev, selling_price: event.target.value }))}
              placeholder="Opcional"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Raciones
            <input
              type="number"
              min="1"
              step="1"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.servings}
              onChange={(event) => setFormState((prev) => ({ ...prev, servings: event.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-3">
            Notas
            <textarea
              rows={3}
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.notes}
              onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
          <ImageUploader
            initialUrl={existingImageUrl}
            onFileReady={setImageFile}
            disabled={isSubmitting}
          />
        </div>
        <AllergensIndicatorsPicker
          inheritedAllergens={inheritedAllergens}
          inheritedIndicators={inheritedIndicators}
          manualAddAllergens={manualAddAllergens}
          setManualAddAllergens={setManualAddAllergens}
          manualExcludeAllergens={manualExcludeAllergens}
          setManualExcludeAllergens={setManualExcludeAllergens}
          manualAddIndicators={manualAddIndicators}
          setManualAddIndicators={setManualAddIndicators}
          manualExcludeIndicators={manualExcludeIndicators}
          setManualExcludeIndicators={setManualExcludeIndicators}
        />
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
            onClick={deleteDish}
            disabled={isSubmitting}
            className="rounded-full border border-rose-500/70 px-4 py-2 text-sm font-semibold text-rose-200"
          >
            Eliminar plato
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Productos y elaboraciones</h3>
            <p className="text-sm text-slate-400">Define la composición final del plato.</p>
          </div>
          {itemsError ? <p className="text-sm text-rose-400">{itemsError}</p> : null}
        </div>
        <CheffingItemPicker
          ingredients={ingredients}
          subrecipes={subrecipes}
          units={units}
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
                    Añade productos o elaboraciones para calcular el coste.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isEditing = editingItemId === item.id;
                  const editingValues = isEditing ? editingItemState : null;
                  const itemType = item.ingredient_id ? 'Producto' : 'Elaboración';
                  const itemName = item.ingredient?.name ?? item.subrecipe?.name ?? '—';
                  const itemLink = item.ingredient_id
                    ? `/cheffing/productos/${item.ingredient_id}`
                    : item.subrecipe_id
                      ? `/cheffing/elaboraciones/${item.subrecipe_id}`
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
                                              ? (prev.ingredient_id || ingredients[0]?.id || '')
                                              : '',
                                        subrecipe_id:
                                          event.target.value === 'subrecipe'
                                              ? (prev.subrecipe_id || subrecipes[0]?.id || '')
                                              : '',
                                        }
                                      : prev,
                                  )
                                }
                              >
                              <option value="ingredient">Producto</option>
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
                                value={editingValues?.subrecipe_id ?? ''}
                                onChange={(event) =>
                                  setEditingItemState((prev) =>
                                    prev ? { ...prev, subrecipe_id: event.target.value } : prev,
                                  )
                                }
                              >
                                {subrecipes.map((entry) => (
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
                        {formatCurrency(item.line_cost_total ?? null)}
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
