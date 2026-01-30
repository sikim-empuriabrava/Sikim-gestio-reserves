'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { Unit } from '@/lib/cheffing/types';
import { ALLERGENS, INDICATORS } from '@/lib/cheffing/allergensIndicators';

type IngredientFormState = {
  name: string;
  purchase_unit_code: string;
  purchase_pack_qty: string;
  purchase_price: string;
  waste_pct: string;
  allergens: string[];
  indicators: string[];
};

type IngredientsNewFormProps = {
  units: Unit[];
};

export function IngredientsNewForm({ units }: IngredientsNewFormProps) {
  const router = useRouter();
  const hasUnits = units.length > 0;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<IngredientFormState>({
    name: '',
    purchase_unit_code: units[0]?.code ?? '',
    purchase_pack_qty: '1',
    purchase_price: '0',
    waste_pct: '0',
    allergens: [],
    indicators: [],
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

  const ensureValidAmount = (value: string, { allowZero }: { allowZero: boolean }) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return null;
    }
    if (allowZero ? numericValue < 0 : numericValue <= 0) {
      return null;
    }
    return numericValue;
  };

  const toggleSelection = (field: 'allergens' | 'indicators', code: string) => {
    setFormState((prev) => {
      const next = new Set(prev[field]);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return { ...prev, [field]: Array.from(next) };
    });
  };

  const submitNewIngredient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!hasUnits) {
        throw new Error('Configura unidades antes de crear ingredientes.');
      }

      const packQtyValue = ensureValidAmount(formState.purchase_pack_qty, { allowZero: false });
      if (packQtyValue === null) {
        throw new Error('La cantidad del pack debe ser mayor que 0.');
      }

      const priceValue = ensureValidAmount(formState.purchase_price, { allowZero: true });
      if (priceValue === null) {
        throw new Error('El precio del pack debe ser un número válido.');
      }

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
          purchase_pack_qty: packQtyValue,
          purchase_price: priceValue,
          waste_pct: wastePctValue,
          allergens: formState.allergens,
          indicators: formState.indicators,
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
        {!hasUnits ? (
          <p className="text-sm text-amber-300">Configura unidades antes de crear ingredientes.</p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Alérgenos</p>
            <p className="text-sm text-slate-400">Selecciona los alérgenos del producto.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALLERGENS.map((allergen) => {
              const isActive = formState.allergens.includes(allergen.key);
              return (
                <button
                  key={allergen.key}
                  type="button"
                  onClick={() => toggleSelection('allergens', allergen.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'border-emerald-400/70 bg-emerald-500/10 text-emerald-100'
                      : 'border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  {allergen.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Indicadores</p>
            <p className="text-sm text-slate-400">Destaca características del producto.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {INDICATORS.map((indicator) => {
              const isActive = formState.indicators.includes(indicator.key);
              return (
                <button
                  key={indicator.key}
                  type="button"
                  onClick={() => toggleSelection('indicators', indicator.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'border-sky-400/70 bg-sky-500/10 text-sky-100'
                      : 'border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  {indicator.label}
                </button>
              );
            })}
          </div>
        </div>
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
            disabled={!hasUnits}
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
            disabled={!hasUnits}
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
            min="0.01"
            step="0.01"
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            value={formState.purchase_pack_qty}
            onChange={(event) => setFormState((prev) => ({ ...prev, purchase_pack_qty: event.target.value }))}
            required
            disabled={!hasUnits}
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
            disabled={!hasUnits}
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
