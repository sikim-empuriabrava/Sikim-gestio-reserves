'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CheffingItemPicker } from '@/app/(cheffing)/cheffing/components/CheffingItemPicker';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';

type SubrecipeFormState = {
  name: string;
  output_unit_code: string;
  output_qty: string;
  waste_pct: string;
  notes: string;
};

type SubrecipeNewFormProps = {
  ingredients: Ingredient[];
  subrecipes: Subrecipe[];
  units: Unit[];
};

type DraftSubrecipeItem = {
  id: string;
  itemType: 'ingredient' | 'subrecipe';
  ingredient_id: string;
  subrecipe_component_id: string;
  unit_code: string;
  quantity: string;
  waste_pct: string;
  notes: string;
};

export function SubrecipeNewForm({ ingredients, subrecipes, units }: SubrecipeNewFormProps) {
  const router = useRouter();
  const hasUnits = units.length > 0;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftSubrecipeItem[]>([]);
  const [formState, setFormState] = useState<SubrecipeFormState>({
    name: '',
    output_unit_code: units[0]?.code ?? '',
    output_qty: '1',
    waste_pct: '0',
    notes: '',
  });

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => a.code.localeCompare(b.code));
  }, [units]);

  const ingredientById = useMemo(() => new Map(ingredients.map((item) => [item.id, item])), [ingredients]);
  const subrecipeById = useMemo(() => new Map(subrecipes.map((item) => [item.id, item])), [subrecipes]);

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
        subrecipe_component_id: type === 'subrecipe' ? id : '',
        unit_code: unitCode,
        quantity: '1',
        waste_pct: '0',
        notes: '',
      },
    ]);
  };

  const updateDraftItem = (id: string, changes: Partial<DraftSubrecipeItem>) => {
    setDraftItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  };

  const submitNewSubrecipe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!hasUnits) {
        throw new Error('Configura unidades antes de crear elaboraciones.');
      }

      const outputQtyValue = ensureValidQuantity(formState.output_qty);
      if (outputQtyValue === null) {
        throw new Error('La producción debe ser mayor que 0.');
      }

      const wastePctValue = parseWastePct(formState.waste_pct);
      if (wastePctValue === null) {
        throw new Error('La merma debe estar entre 0 y 99,99%.');
      }

      const notesValue = formState.notes.trim();
      const itemPayload = draftItems.map((item) => {
        const quantityValue = ensureValidQuantity(item.quantity);
        if (quantityValue === null) {
          throw new Error('La cantidad debe ser mayor que 0.');
        }

        const itemWastePctValue = parseWastePct(item.waste_pct);
        if (itemWastePctValue === null) {
          throw new Error('La merma debe estar entre 0 y 99,99%.');
        }

        const itemNotes = item.notes.trim();

        return {
          ingredient_id: item.itemType === 'ingredient' ? item.ingredient_id : null,
          subrecipe_component_id: item.itemType === 'subrecipe' ? item.subrecipe_component_id : null,
          unit_code: item.unit_code,
          quantity: quantityValue,
          waste_pct: itemWastePctValue,
          notes: itemNotes.length > 0 ? itemNotes : null,
        };
      });

      const response = await fetch('/api/cheffing/subrecipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subrecipe: {
            name: formState.name,
            output_unit_code: formState.output_unit_code,
            output_qty: outputQtyValue,
            waste_pct: wastePctValue,
            notes: notesValue.length > 0 ? notesValue : null,
          },
          // TODO: agregar agregación de alérgenos cuando se defina el flujo completo.
          items: itemPayload,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Ya existe una elaboración con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error creando elaboración');
      }

      if (payload?.id) {
        router.push(`/cheffing/elaboraciones/${payload.id}`);
      } else {
        router.push('/cheffing/elaboraciones');
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
        onSubmit={submitNewSubrecipe}
        className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Nueva elaboración</h3>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {!hasUnits ? (
            <p className="text-sm text-amber-300">Configura unidades antes de crear elaboraciones.</p>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Nombre
            <input
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ej. Cebolla caramelizada"
              required
              disabled={!hasUnits}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Producción
            <div className="flex gap-2">
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="w-28 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                value={formState.output_qty}
                onChange={(event) => setFormState((prev) => ({ ...prev, output_qty: event.target.value }))}
                required
                disabled={!hasUnits}
              />
              <select
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                value={formState.output_unit_code}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, output_unit_code: event.target.value }))
                }
                disabled={!hasUnits}
              >
                {sortedUnits.map((unit) => (
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
              disabled={!hasUnits}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-4">
            Notas
            <textarea
              className="min-h-[90px] rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.notes}
              onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Opcional"
              disabled={!hasUnits}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !hasUnits}
            className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar elaboración
          </button>
          <button
            type="button"
            onClick={() => router.push('/cheffing/elaboraciones')}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Ingredientes / Elaboraciones (opcional)</h3>
            <p className="text-sm text-slate-400">Define los componentes antes de guardar.</p>
          </div>
        </div>
        <CheffingItemPicker
          ingredients={ingredients}
          subrecipes={subrecipes}
          units={units}
          ingredientNewHref="/cheffing/productos/new"
          subrecipeNewHref="/cheffing/elaboraciones/new"
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
                  <th className="px-4 py-3">Merma</th>
                  <th className="px-4 py-3">Notas</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {draftItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                      Añade productos o elaboraciones para precargar la receta.
                    </td>
                  </tr>
                ) : (
                  draftItems.map((item) => {
                    const isIngredient = item.itemType === 'ingredient';
                    const name = isIngredient
                      ? ingredientById.get(item.ingredient_id)?.name
                      : subrecipeById.get(item.subrecipe_component_id)?.name;
                    const href = isIngredient
                      ? `/cheffing/productos/${item.ingredient_id}`
                      : `/cheffing/elaboraciones/${item.subrecipe_component_id}`;

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
                            value={item.waste_pct}
                            onChange={(event) => updateDraftItem(item.id, { waste_pct: event.target.value })}
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
