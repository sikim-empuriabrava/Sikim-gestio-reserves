'use client';

import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { Ingredient, Subrecipe, Unit, UnitDimension } from '@/lib/cheffing/types';

type CheffingItemPickerProps = {
  ingredients: Ingredient[];
  subrecipes: Subrecipe[];
  units: Unit[];
  ingredientNewHref: string;
  subrecipeNewHref: string;
  mode?: 'recipe' | 'stock';
  isSubmitting?: boolean;
  onAddItem: (payload: { type: 'ingredient' | 'subrecipe'; id: string; unitCode: string }) => Promise<void>;
  children: ReactNode;
};

export function CheffingItemPicker({
  ingredients,
  subrecipes,
  units,
  ingredientNewHref,
  subrecipeNewHref,
  mode = 'recipe',
  isSubmitting,
  onAddItem,
  children,
}: CheffingItemPickerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ingredient' | 'subrecipe'>(
    ingredients.length > 0 ? 'ingredient' : 'subrecipe',
  );
  const [searchTerm, setSearchTerm] = useState('');
  const hasUnits = units.length > 0;
  const [selectedUnitCodeById, setSelectedUnitCodeById] = useState<Record<string, string>>({});

  const normalizeUnitCode = (code: string) => code.trim().toLowerCase();

  const unitByCodeNormalized = useMemo(() => {
    return new Map(units.map((unit) => [normalizeUnitCode(unit.code), unit]));
  }, [units]);

  const unitsByDimension = useMemo(() => {
    const entries = new Map<UnitDimension, Unit[]>();
    units.forEach((unit) => {
      const list = entries.get(unit.dimension) ?? [];
      list.push(unit);
      entries.set(unit.dimension, list);
    });
    entries.forEach((list, dimension) => {
      entries.set(
        dimension,
        [...list].sort((a, b) => a.code.localeCompare(b.code)),
      );
    });
    return entries;
  }, [units]);

  const getUnitFromCode = (code?: string | null): Unit | null => {
    if (!code) return null;
    return unitByCodeNormalized.get(normalizeUnitCode(code)) ?? null;
  };

  const getBaseUnitForDimension = (dimension: UnitDimension): Unit | null => {
    const unitsInDimension = unitsByDimension.get(dimension) ?? [];
    const baseUnits = unitsInDimension.filter((unit) => unit.to_base_factor === 1);
    if (baseUnits.length === 0) return null;
    return [...baseUnits].sort((a, b) => a.code.localeCompare(b.code))[0] ?? null;
  };

  const resolveDimensionForUnitCode = (code: string | null | undefined): UnitDimension | null => {
    return getUnitFromCode(code)?.dimension ?? null;
  };

  const resolveDefaultUnitCode = ({
    preferredCode,
    dimensionFallback,
  }: {
    preferredCode: string | null | undefined;
    dimensionFallback: UnitDimension;
  }) => {
    if (!hasUnits) return '';
    const preferredUnit = getUnitFromCode(preferredCode);
    const resolvedDimension = preferredUnit?.dimension ?? dimensionFallback;
    const unitsInDimension = unitsByDimension.get(resolvedDimension) ?? [];
    if (mode === 'stock' && preferredUnit) {
      return preferredUnit.code.trim();
    }
    const baseUnit = getBaseUnitForDimension(resolvedDimension);
    if (baseUnit) {
      return baseUnit.code.trim();
    }
    return unitsInDimension[0]?.code.trim() ?? '';
  };

  const filteredIngredients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return ingredients;
    return ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(term));
  }, [ingredients, searchTerm]);

  const filteredSubrecipes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return subrecipes;
    return subrecipes.filter((subrecipe) => subrecipe.name.toLowerCase().includes(term));
  }, [searchTerm, subrecipes]);

  const isPendingRef = useRef(false);

  const handleAdd = async (type: 'ingredient' | 'subrecipe', id: string, unitCode: string) => {
    if (!hasUnits || isSubmitting || isPendingRef.current || !unitCode.trim()) return;
    isPendingRef.current = true;
    try {
      await onAddItem({ type, id, unitCode });
    } catch {
      // Parent component already surfaces errors.
    } finally {
      isPendingRef.current = false;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Selector</p>
          <h4 className="text-base font-semibold text-white">Añadir ingredientes o elaboraciones</h4>
        </div>
        <input
          type="search"
          placeholder="Buscar por nombre"
          className="w-full rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white md:w-64"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Link
                href={ingredientNewHref}
                className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300"
                target="_blank"
                rel="noreferrer"
              >
                Nuevo ingrediente
              </Link>
              <Link
                href={subrecipeNewHref}
                className="rounded-full border border-sky-400/60 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:border-sky-300"
                target="_blank"
                rel="noreferrer"
              >
                Nueva elaboración
              </Link>
              <button
                type="button"
                onClick={() => router.refresh()}
                disabled={isSubmitting}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Actualizar lista
              </button>
            </div>
            <div className="flex rounded-full border border-slate-700 bg-slate-950/70 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('ingredient')}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  activeTab === 'ingredient'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Ingredientes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subrecipe')}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  activeTab === 'subrecipe'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Elaboraciones
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-800/70">
            {activeTab === 'ingredient' ? (
              filteredIngredients.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No se encontraron ingredientes.</p>
              ) : (
                <ul className="divide-y divide-slate-800/70">
                  {filteredIngredients.map((ingredient) => {
                    const preferredCode = ingredient.purchase_unit_code;
                    const dimension = resolveDimensionForUnitCode(preferredCode) ?? 'mass';
                    const unitCode =
                      selectedUnitCodeById[ingredient.id] ??
                      resolveDefaultUnitCode({
                        preferredCode: mode === 'stock' ? preferredCode : null,
                        dimensionFallback: dimension,
                      });
                    const purchaseUnitLabel = preferredCode?.trim() ? preferredCode.trim() : '—';
                    const unitsInDimension = unitsByDimension.get(dimension) ?? [];
                    const canAdd = hasUnits && unitsInDimension.length > 0 && Boolean(unitCode.trim());
                    const unitCodeLabel = canAdd ? unitCode.trim() : '—';
                    return (
                      <li key={ingredient.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{ingredient.name}</p>
                          <p className="text-xs text-slate-500">Compra: {purchaseUnitLabel}</p>
                          <p className="text-xs text-slate-500">
                            {canAdd ? `Añadirá en: ${unitCodeLabel}` : 'Configura unidades'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <select
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-white"
                            value={unitCode}
                            onChange={(event) =>
                              setSelectedUnitCodeById((prev) => ({
                                ...prev,
                                [ingredient.id]: event.target.value,
                              }))
                            }
                            disabled={!hasUnits || unitsInDimension.length === 0}
                          >
                            {unitsInDimension.length === 0 ? (
                              <option value="">Sin unidades</option>
                            ) : (
                              unitsInDimension.map((unit) => (
                                <option key={unit.code} value={unit.code}>
                                  {unit.code}
                                </option>
                              ))
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAdd('ingredient', ingredient.id, unitCode)}
                            disabled={isSubmitting || !canAdd}
                            className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Añadir (1 {unitCodeLabel}) →
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : filteredSubrecipes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No se encontraron elaboraciones.</p>
            ) : (
              <ul className="divide-y divide-slate-800/70">
                {filteredSubrecipes.map((subrecipe) => {
                  const preferredCode = subrecipe.output_unit_code;
                  const dimension = resolveDimensionForUnitCode(preferredCode) ?? 'mass';
                  const unitCode =
                    selectedUnitCodeById[subrecipe.id] ??
                    resolveDefaultUnitCode({
                      preferredCode: mode === 'stock' ? preferredCode : null,
                      dimensionFallback: dimension,
                    });
                  const outputUnitLabel = preferredCode?.trim() ? preferredCode.trim() : '—';
                  const unitsInDimension = unitsByDimension.get(dimension) ?? [];
                  const canAdd = hasUnits && unitsInDimension.length > 0 && Boolean(unitCode.trim());
                  const unitCodeLabel = canAdd ? unitCode.trim() : '—';
                  return (
                    <li key={subrecipe.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{subrecipe.name}</p>
                        <p className="text-xs text-slate-500">Salida: {outputUnitLabel}</p>
                        <p className="text-xs text-slate-500">
                          {canAdd ? `Añadirá en: ${unitCodeLabel}` : 'Configura unidades'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <select
                          className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-white"
                          value={unitCode}
                          onChange={(event) =>
                            setSelectedUnitCodeById((prev) => ({
                              ...prev,
                              [subrecipe.id]: event.target.value,
                            }))
                          }
                          disabled={!hasUnits || unitsInDimension.length === 0}
                        >
                          {unitsInDimension.length === 0 ? (
                            <option value="">Sin unidades</option>
                          ) : (
                            unitsInDimension.map((unit) => (
                              <option key={unit.code} value={unit.code}>
                                {unit.code}
                              </option>
                            ))
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAdd('subrecipe', subrecipe.id, unitCode)}
                          disabled={isSubmitting || !canAdd}
                          className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Añadir (1 {unitCodeLabel}) →
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Elementos seleccionados</p>
            <p className="text-sm text-slate-400">Revisa y ajusta cantidades o mermas.</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
