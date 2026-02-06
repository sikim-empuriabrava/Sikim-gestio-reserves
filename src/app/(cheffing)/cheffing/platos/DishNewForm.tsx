'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CheffingItemPicker } from '@/app/(cheffing)/cheffing/components/CheffingItemPicker';
import { ImageUploader } from '@/app/(cheffing)/cheffing/components/ImageUploader';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type DishFormState = {
  name: string;
  selling_price: string;
  servings: string;
  notes: string;
};

type DishNewFormProps = {
  ingredients: Ingredient[];
  subrecipes: Subrecipe[];
  units: Unit[];
  canManageImages: boolean;
};

type DraftDishItem = {
  id: string;
  itemType: 'ingredient' | 'subrecipe';
  ingredient_id: string;
  subrecipe_id: string;
  unit_code: string;
  quantity: string;
  waste_pct_override: string;
  notes: string;
};

export function DishNewForm({ ingredients, subrecipes, units, canManageImages }: DishNewFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftDishItem[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formState, setFormState] = useState<DishFormState>({
    name: '',
    selling_price: '',
    servings: '1',
    notes: '',
  });

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => a.code.localeCompare(b.code));
  }, [units]);

  const ingredientById = useMemo(
    () => new Map<string, Ingredient>(ingredients.map((item) => [item.id, item] as const)),
    [ingredients],
  );
  const subrecipeById = useMemo(
    () => new Map<string, Subrecipe>(subrecipes.map((item) => [item.id, item] as const)),
    [subrecipes],
  );

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

  const getTempId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const addDraftItem = async ({
    type,
    id,
    unitCode,
  }: {
    type: 'ingredient' | 'subrecipe';
    id: string;
    unitCode: string;
  }) => {
    setDraftItems((prev) => [
      ...prev,
      {
        id: getTempId(),
        itemType: type,
        ingredient_id: type === 'ingredient' ? id : '',
        subrecipe_id: type === 'subrecipe' ? id : '',
        unit_code: unitCode,
        quantity: '1',
        waste_pct_override: '',
        notes: '',
      },
    ]);
  };

  const updateDraftItem = (id: string, changes: Partial<DraftDishItem>) => {
    setDraftItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  };

  const submitNewDish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setImageWarning(null);
    setIsSubmitting(true);

    try {
      const sellingPriceValue =
        formState.selling_price.trim() === '' ? null : Number(formState.selling_price);
      const servingsValue = Number(formState.servings);

      if (sellingPriceValue !== null && (!Number.isFinite(sellingPriceValue) || sellingPriceValue < 0)) {
        throw new Error('El PVP debe ser un número válido.');
      }

      if (!Number.isFinite(servingsValue) || servingsValue <= 0) {
        throw new Error('Las raciones deben ser mayores que 0.');
      }

      const notesValue = formState.notes.trim();
      const itemPayload = draftItems.map((item) => {
        const quantityValue = ensureValidQuantity(item.quantity);
        if (quantityValue === null) {
          throw new Error('La cantidad debe ser mayor que 0.');
        }

        const itemWastePctValue = parseWastePct(item.waste_pct_override);
        if (itemWastePctValue === undefined) {
          throw new Error('La merma debe estar entre 0 y 99,99%.');
        }

        const itemNotes = item.notes.trim();

        return {
          ingredient_id: item.itemType === 'ingredient' ? item.ingredient_id : null,
          subrecipe_id: item.itemType === 'subrecipe' ? item.subrecipe_id : null,
          unit_code: item.unit_code,
          quantity: quantityValue,
          waste_pct_override: itemWastePctValue,
          notes: itemNotes.length > 0 ? itemNotes : null,
        };
      });

      const response = await fetch('/api/cheffing/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish: {
            name: formState.name,
            selling_price: sellingPriceValue,
            servings: servingsValue,
            notes: notesValue.length > 0 ? notesValue : null,
          },
          items: itemPayload,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Ya existe un plato con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error creando plato');
      }

      const createdId = typeof payload?.id === 'string' ? payload.id : null;
      if (createdId && imageFile && canManageImages) {
        let uploadedPath: string | null = null;
        try {
          const extension = imageFile.type === 'image/webp' ? 'webp' : 'jpg';
          const path = `dishes/${createdId}/main.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from('cheffing-images')
            .upload(path, imageFile, { upsert: true, contentType: imageFile.type });

          if (uploadError) {
            throw new Error('Error subiendo la imagen del plato.');
          }

          uploadedPath = path;
          const patchResponse = await fetch(`/api/cheffing/dishes/${createdId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_path: path }),
          });

          if (!patchResponse.ok) {
            throw new Error('Error guardando la imagen del plato.');
          }
          setImageFile(null);
        } catch (imageError) {
          if (uploadedPath) {
            await supabase.storage.from('cheffing-images').remove([uploadedPath]);
          }
          setImageWarning(
            imageError instanceof Error ? imageError.message : 'No se pudo guardar la imagen del plato.',
          );
        }
      }

      if (createdId) {
        router.push(`/cheffing/platos/${createdId}`);
      } else {
        router.push('/cheffing/platos');
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
      <form
        onSubmit={submitNewDish}
        className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Nuevo plato</h3>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {imageWarning ? <p className="text-sm text-amber-300">{imageWarning}</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Nombre
            <input
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ej. Burger X"
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
              className="min-h-[90px] rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.notes}
              onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Opcional"
            />
          </label>
          {canManageImages ? (
            <div className="md:col-span-3">
              <ImageUploader
                label="Imagen del plato"
                initialUrl={null}
                onFileReady={setImageFile}
                disabled={isSubmitting}
                readOnly={!canManageImages}
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar plato
          </button>
          <button
            type="button"
            onClick={() => router.push('/cheffing/platos')}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Productos / Elaboraciones (opcional)</h3>
            <p className="text-sm text-slate-400">Añade la composición antes de guardar.</p>
          </div>
        </div>
        <CheffingItemPicker
          ingredients={ingredients}
          subrecipes={subrecipes}
          units={units}
          mode="recipe"
          isSubmitting={isSubmitting}
          onAddItem={addDraftItem}
        >
          <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
            <table className="w-full min-w-[960px] text-left text-sm text-slate-200">
              <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Detalle</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Merma (%)</th>
                  <th className="px-4 py-3">Notas</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {draftItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                      Añade productos o elaboraciones para precargar el plato.
                    </td>
                  </tr>
                ) : (
                  draftItems.map((item) => {
                    const isIngredient = item.itemType === 'ingredient';
                    const name = isIngredient
                      ? ingredientById.get(item.ingredient_id)?.name
                      : subrecipeById.get(item.subrecipe_id)?.name;
                    const href = isIngredient
                      ? `/cheffing/productos/${item.ingredient_id}`
                      : `/cheffing/elaboraciones/${item.subrecipe_id}`;

                    return (
                      <tr key={item.id} className="border-t border-slate-800/60">
                        <td className="px-4 py-3">{isIngredient ? 'Producto' : 'Elaboración'}</td>
                        <td className="px-4 py-3">
                          {name ? (
                            <Link href={href} className="font-semibold text-white">
                              {name}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                              value={item.quantity}
                              onChange={(event) => updateDraftItem(item.id, { quantity: event.target.value })}
                            />
                            <select
                              className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                              value={item.unit_code}
                              onChange={(event) => updateDraftItem(item.id, { unit_code: event.target.value })}
                            >
                              {sortedUnits.map((unit) => (
                                <option key={unit.code} value={unit.code}>
                                  {unit.code}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="99.99"
                            step="0.01"
                            className="w-20 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                            value={item.waste_pct_override}
                            onChange={(event) =>
                              updateDraftItem(item.id, { waste_pct_override: event.target.value })
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <input
                            className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                            value={item.notes}
                            onChange={(event) => updateDraftItem(item.id, { notes: event.target.value })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeDraftItem(item.id)}
                            className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200"
                          >
                            Eliminar
                          </button>
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
