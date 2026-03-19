'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ImageUploader } from '@/app/(cheffing)/cheffing/components/ImageUploader';
import type { Dish, DishItem, Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';
import { ALLERGENS, DISH_INDICATORS, PRODUCT_INDICATORS } from '@/lib/cheffing/allergensIndicators';
import { toAllergenKeys, toDishIndicatorKeys } from '@/lib/cheffing/allergensHelpers';
import { CheffingItemPicker } from '@/app/(cheffing)/cheffing/components/CheffingItemPicker';
import { formatEditableMoney, parseEditableMoney } from '@/lib/cheffing/money';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { CheffingFamily } from '@/lib/cheffing/families';
import { SIN_FAMILIA_LABEL } from '@/lib/cheffing/families';

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
  families: CheffingFamily[];
  inheritedAllergens: string[];
  inheritedIndicators: string[];
  canManageImages: boolean;
};

type DishFormState = {
  name: string;
  selling_price: string;
  servings: string;
  family_id: string;
  notes: string;
  allergen_codes: string[];
  indicator_codes: string[];
};

type ItemFormState = {
  itemType: 'ingredient' | 'subrecipe';
  ingredient_id: string;
  subrecipe_id: string;
  unit_code: string;
  quantity: string;
  waste_pct_override: string;
  notes: string;
};

export function DishDetailManager({
  dish,
  items,
  ingredients,
  subrecipes,
  units,
  families,
  inheritedAllergens,
  inheritedIndicators,
  canManageImages,
}: DishDetailManagerProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemState, setEditingItemState] = useState<ItemFormState | null>(null);
  const [formState, setFormState] = useState<DishFormState>({
    name: dish.name,
    selling_price: formatEditableMoney(dish.selling_price),
    servings: String(dish.servings ?? 1),
    family_id: dish.family_id ?? '',
    notes: dish.notes ?? '',
    allergen_codes: dish.allergen_codes ?? [],
    indicator_codes: dish.indicator_codes ?? [],
  });

  const existingImageUrl = useMemo(() => {
    if (!dish.image_path) return null;
    const { data } = supabase.storage.from('cheffing-images').getPublicUrl(dish.image_path);
    const cacheKey = dish.updated_at ?? Date.now().toString();
    return `${data.publicUrl}?v=${encodeURIComponent(cacheKey)}`;
  }, [dish.image_path, dish.updated_at, supabase]);

  const toggleCode = (field: 'allergen_codes' | 'indicator_codes', code: string) => {
    setFormState((prev) => {
      const next = new Set(prev[field]);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...prev, [field]: Array.from(next) };
    });
  };

  const ingredientsById = useMemo(() => {
    return new Map<string, Ingredient>(ingredients.map((ingredient) => [ingredient.id, ingredient] as const));
  }, [ingredients]);

  const formatCurrency = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

  const wasteHelpText =
    'La merma de esta línea sustituye la merma base solo para esta línea, pero no puede ser inferior a la merma base del ingrediente o elaboración. Si se deja vacío, se usa la merma base heredada.';

  const parseWastePct = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const percentValue = Number(trimmed);
    if (!Number.isFinite(percentValue) || percentValue < 0 || percentValue >= 100) {
      return undefined;
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

  const resolveEffectiveWastePct = (item: DishItemWithDetails) => {
    if (item.waste_pct_override !== null && item.waste_pct_override !== undefined) {
      return item.waste_pct_override;
    }
    if (item.ingredient_id) {
      return ingredientsById.get(item.ingredient_id)?.waste_pct ?? 0;
    }
    return 0;
  };

  const saveHeader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHeaderError(null);
    setImageWarning(null);
    setIsSubmitting(true);

    try {
      const sellingPriceValue = parseEditableMoney(formState.selling_price);
      const servingsValue = Number(formState.servings);

      if (sellingPriceValue !== null && sellingPriceValue < 0) {
        throw new Error('El PVP debe ser un número válido.');
      }

      if (!Number.isFinite(servingsValue) || servingsValue <= 0) {
        throw new Error('Las raciones deben ser mayores que 0.');
      }

      const response = await fetch(`/api/cheffing/dishes/${dish.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          selling_price: sellingPriceValue,
          servings: servingsValue,
          family_id: formState.family_id || null,
          notes: formState.notes.trim() ? formState.notes.trim() : null,
          allergen_codes: toAllergenKeys(formState.allergen_codes),
          indicator_codes: toDishIndicatorKeys(formState.indicator_codes),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe un plato con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error actualizando plato');
      }
      if (imageFile && canManageImages) {
        let uploadedPath: string | null = null;
        try {
          const extension = imageFile.type === 'image/webp' ? 'webp' : 'jpg';
          const path = `dishes/${dish.id}/main.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from('cheffing-images')
            .upload(path, imageFile, { upsert: true, contentType: imageFile.type });

          if (uploadError) {
            throw new Error('Error subiendo la imagen del plato.');
          }

          uploadedPath = path;
          const patchResponse = await fetch(`/api/cheffing/dishes/${dish.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_path: path }),
          });
          if (!patchResponse.ok) {
            throw new Error('Error guardando la imagen del plato.');
          }
          if (dish.image_path && dish.image_path !== path) {
            await supabase.storage.from('cheffing-images').remove([dish.image_path]);
          }
          setImageFile(null);
        } catch (imageError) {
          if (uploadedPath) {
            await supabase.storage.from('cheffing-images').remove([uploadedPath]);
          }
          setImageWarning(imageError instanceof Error ? imageError.message : 'No se pudo guardar la imagen del plato.');
        }
      }

      router.refresh();
      // TODO: Auto-select the newly added line for editing once we can identify it reliably.
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!dish.image_path || !canManageImages) return;
    setImageWarning(null);
    setIsSubmitting(true);
    try {
      const confirmed = window.confirm('¿Seguro que quieres eliminar la imagen?');
      if (!confirmed) return;
      const { error: removeError } = await supabase.storage.from('cheffing-images').remove([dish.image_path]);
      if (removeError) {
        throw new Error('Error eliminando la imagen del plato.');
      }
      const patchResponse = await fetch(`/api/cheffing/dishes/${dish.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_path: null }),
      });
      if (!patchResponse.ok) {
        throw new Error('Error guardando la eliminación de la imagen.');
      }
      setImageFile(null);
      router.refresh();
    } catch (err) {
      setImageWarning(err instanceof Error ? err.message : 'No se pudo eliminar la imagen.');
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
          waste_pct_override: null,
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
      waste_pct_override:
        item.waste_pct_override === null || item.waste_pct_override === undefined
          ? ''
          : String((item.waste_pct_override * 100).toFixed(2)),
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

      const wastePctValue = parseWastePct(editingItemState.waste_pct_override);
      if (wastePctValue === undefined) {
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
          waste_pct_override: wastePctValue,
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
        {imageWarning ? <p className="text-sm text-amber-300">{imageWarning}</p> : null}
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
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Familia
            <select
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.family_id}
              onChange={(event) => setFormState((prev) => ({ ...prev, family_id: event.target.value }))}
            >
              <option value="">{SIN_FAMILIA_LABEL}</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
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
          <div className="space-y-3 md:col-span-3">
            <p className="text-xs uppercase text-slate-500">Alérgenos heredados (solo lectura)</p>
            {inheritedAllergens.length === 0 ? (
              <p className="text-xs text-slate-500">Sin alérgenos heredados.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.filter((allergen) => inheritedAllergens.includes(allergen.key)).map((allergen) => (
                  <span
                    key={allergen.key}
                    className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200"
                  >
                    {allergen.label}
                  </span>
                ))}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ALLERGENS.map((allergen) => (
                <label
                  key={allergen.key}
                  className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-400"
                    checked={formState.allergen_codes.includes(allergen.key)}
                    onChange={() => toggleCode('allergen_codes', allergen.key)}
                  />
                  {allergen.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3 md:col-span-3">
            <p className="text-xs uppercase text-slate-500">Indicadores heredados (solo lectura)</p>
            {inheritedIndicators.length === 0 ? (
              <p className="text-xs text-slate-500">Sin indicadores heredados.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {PRODUCT_INDICATORS.filter((indicator) => inheritedIndicators.includes(indicator.key)).map(
                  (indicator) => (
                    <span
                      key={indicator.key}
                      className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200"
                    >
                      {indicator.label}
                    </span>
                  ),
                )}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {DISH_INDICATORS.map((indicator) => (
                <label
                  key={indicator.key}
                  className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-400"
                    checked={formState.indicator_codes.includes(indicator.key)}
                    onChange={() => toggleCode('indicator_codes', indicator.key)}
                  />
                  {indicator.label}
                </label>
              ))}
            </div>
          </div>
          {canManageImages ? (
            <div className="space-y-3 md:col-span-3">
              <ImageUploader
                label="Imagen del plato"
                initialUrl={existingImageUrl}
                onFileReady={setImageFile}
                disabled={isSubmitting}
                readOnly={!canManageImages}
              />
              {dish.image_path ? (
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  disabled={isSubmitting}
                  className="rounded-full border border-rose-500/70 px-4 py-2 text-xs font-semibold text-rose-200"
                >
                  Eliminar imagen
                </button>
              ) : null}
            </div>
          ) : null}
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
                <th className="px-4 py-3">
                  <div className="group relative inline-flex items-center gap-1">
                    <span>Merma (%)</span>
                    <button
                      type="button"
                      aria-label="Ayuda sobre merma"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-semibold text-slate-300"
                    >
                      ?
                    </button>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 rounded-md border border-slate-700 bg-slate-950/95 p-2 text-[11px] normal-case text-slate-200 opacity-0 shadow-lg transition-opacity delay-700 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {wasteHelpText}
                    </div>
                  </div>
                </th>
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
                            title={wasteHelpText}
                            value={editingValues?.waste_pct_override ?? ''}
                            onChange={(event) =>
                              setEditingItemState((prev) =>
                                prev ? { ...prev, waste_pct_override: event.target.value } : prev,
                              )
                            }
                          />
                        ) : (
                          `${(resolveEffectiveWastePct(item) * 100).toFixed(2)}%`
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
