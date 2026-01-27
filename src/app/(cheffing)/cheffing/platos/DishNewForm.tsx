'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type DishFormState = {
  name: string;
  selling_price: string;
  servings: string;
  notes: string;
};

export function DishNewForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<DishFormState>({
    name: '',
    selling_price: '',
    servings: '1',
    notes: '',
  });

  const submitNewDish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
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

      const response = await fetch('/api/cheffing/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          selling_price: sellingPriceValue,
          servings: servingsValue,
          notes: notesValue.length > 0 ? notesValue : null,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Ya existe un plato con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error creando plato');
      }

      if (payload?.id) {
        router.push(`/cheffing/platos/${payload.id}`);
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
    <form
      onSubmit={submitNewDish}
      className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Nuevo plato</h3>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
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
  );
}
