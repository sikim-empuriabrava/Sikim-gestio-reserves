'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { Unit } from '@/lib/cheffing/types';

type IngredientFormState = {
  name: string;
  purchase_unit_code: string;
  purchase_pack_qty: string;
  purchase_price: string;
  waste_pct: string;
};

type IngredientsNewFormProps = {
  units: Unit[];
};

export function IngredientsNewForm({ units }: IngredientsNewFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<IngredientFormState>({
    name: '',
    purchase_unit_code: units[0]?.code ?? 'g',
    purchase_pack_qty: '1',
    purchase_price: '0',
    waste_pct: '0',
  });

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => a.code.localeCompare(b.code));
  }, [units]);

  const parseWastePct = (value: string) => {
    const percentValue = Number(value);
    if (!Number.isFinite(percentValue) || percentValue < 0 || percentValue >= 100) {
      return null;
    }
    return percentValue / 100;
  };

  const submitNewIngredient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const wastePctValue = parseWastePct(formState.waste_pct);
      if (wastePctValue === null) {
        throw new Error('La merma debe estar entre 0 y 99,99%.');
      }

      const response = await fetch('/api/cheffing/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          purchase_unit_code: formState.purchase_unit_code,
          purchase_pack_qty: Number(formState.purchase_pack_qty),
          purchase_price: Number(formState.purchase_price),
          waste_pct: wastePctValue,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe un ingrediente con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error creando ingrediente');
      }

      router.push('/cheffing/ingredientes');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submitNewIngredient}
      className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Nuevo ingrediente</h3>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Nombre
          <input
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            value={formState.name}
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Ej. Tomate triturado"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Unidad compra
          <select
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            value={formState.purchase_unit_code}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, purchase_unit_code: event.target.value }))
            }
          >
            {sortedUnits.map((unit) => (
              <option key={unit.code} value={unit.code}>
                {unit.code} · {unit.name ?? unit.code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Cantidad pack
          <input
            type="number"
            min="0"
            step="0.01"
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            value={formState.purchase_pack_qty}
            onChange={(event) => setFormState((prev) => ({ ...prev, purchase_pack_qty: event.target.value }))}
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Precio pack (€)
          <input
            type="number"
            min="0"
            step="0.01"
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            value={formState.purchase_price}
            onChange={(event) => setFormState((prev) => ({ ...prev, purchase_price: event.target.value }))}
            required
          />
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
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Guardar ingrediente
        </button>
        <button
          type="button"
          onClick={() => router.push('/cheffing/ingredientes')}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
