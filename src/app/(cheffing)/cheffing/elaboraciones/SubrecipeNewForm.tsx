'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { Unit } from '@/lib/cheffing/types';

type SubrecipeFormState = {
  name: string;
  output_unit_code: string;
  output_qty: string;
  waste_pct: string;
  notes: string;
};

type SubrecipeNewFormProps = {
  units: Unit[];
};

export function SubrecipeNewForm({ units }: SubrecipeNewFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<SubrecipeFormState>({
    name: '',
    output_unit_code: units[0]?.code ?? 'g',
    output_qty: '1',
    waste_pct: '0',
    notes: '',
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

  const ensureValidQuantity = (value: string) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }
    return numericValue;
  };

  const submitNewSubrecipe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
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

      const notesValue = formState.notes.trim();

      const response = await fetch('/api/cheffing/subrecipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          output_unit_code: formState.output_unit_code,
          output_qty: outputQtyValue,
          waste_pct: wastePctValue,
          notes: notesValue.length > 0 ? notesValue : null,
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
    <form
      onSubmit={submitNewSubrecipe}
      className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Nueva elaboración</h3>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
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
            />
            <select
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.output_unit_code}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, output_unit_code: event.target.value }))
              }
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
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-4">
          Notas
          <textarea
            className="min-h-[90px] rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            value={formState.notes}
            onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Opcional"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
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
  );
}
