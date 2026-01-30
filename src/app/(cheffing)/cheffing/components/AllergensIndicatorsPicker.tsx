'use client';

import { useMemo } from 'react';

import {
  ALLERGENS,
  ALLERGEN_KEYS,
  INDICATORS,
  INDICATOR_KEYS,
  type AllergenKey,
  type IndicatorKey,
} from '@/lib/cheffing/allergensIndicators';

type AllergensIndicatorsPickerProps = {
  inheritedAllergens: string[];
  inheritedIndicators: string[];
  manualAddAllergens: string[];
  setManualAddAllergens: (value: string[]) => void;
  manualExcludeAllergens: string[];
  setManualExcludeAllergens: (value: string[]) => void;
  manualAddIndicators: string[];
  setManualAddIndicators: (value: string[]) => void;
  manualExcludeIndicators: string[];
  setManualExcludeIndicators: (value: string[]) => void;
};

type KeyConfig = {
  key: string;
  label: string;
};

const isAllergenKey = (value: string): value is AllergenKey =>
  (ALLERGEN_KEYS as ReadonlySet<string>).has(value);

const isIndicatorKey = (value: string): value is IndicatorKey =>
  (INDICATOR_KEYS as ReadonlySet<string>).has(value);

function buildLabelMap(items: readonly KeyConfig[]) {
  return new Map(items.map((item) => [item.key, item.label]));
}

function resolveOrdered(keys: Set<string>, orderedList: readonly KeyConfig[]) {
  return orderedList.map((item) => item.key).filter((key) => keys.has(key));
}

function toggleManualSelection({
  key,
  inheritedSet,
  effectiveSet,
  manualAdd,
  manualExclude,
  setManualAdd,
  setManualExclude,
}: {
  key: string;
  inheritedSet: Set<string>;
  effectiveSet: Set<string>;
  manualAdd: string[];
  manualExclude: string[];
  setManualAdd: (value: string[]) => void;
  setManualExclude: (value: string[]) => void;
}) {
  const isInherited = inheritedSet.has(key);
  const isEffective = effectiveSet.has(key);

  if (isInherited) {
    if (isEffective) {
      setManualExclude(Array.from(new Set([...manualExclude, key])));
      setManualAdd(manualAdd.filter((entry) => entry !== key));
    } else {
      setManualExclude(manualExclude.filter((entry) => entry !== key));
    }
    return;
  }

  if (isEffective) {
    setManualAdd(manualAdd.filter((entry) => entry !== key));
  } else {
    setManualAdd(Array.from(new Set([...manualAdd, key])));
  }
  setManualExclude(manualExclude.filter((entry) => entry !== key));
}

export function AllergensIndicatorsPicker({
  inheritedAllergens,
  inheritedIndicators,
  manualAddAllergens,
  setManualAddAllergens,
  manualExcludeAllergens,
  setManualExcludeAllergens,
  manualAddIndicators,
  setManualAddIndicators,
  manualExcludeIndicators,
  setManualExcludeIndicators,
}: AllergensIndicatorsPickerProps) {
  const allergenLabelMap = useMemo(() => buildLabelMap(ALLERGENS), []);
  const indicatorLabelMap = useMemo(() => buildLabelMap(INDICATORS), []);

  const inheritedAllergenSet = useMemo(() => {
    return new Set(inheritedAllergens.filter(isAllergenKey));
  }, [inheritedAllergens]);

  const inheritedIndicatorSet = useMemo(() => {
    return new Set(inheritedIndicators.filter(isIndicatorKey));
  }, [inheritedIndicators]);

  const manualAddAllergenSet = useMemo(() => {
    return new Set(manualAddAllergens.filter(isAllergenKey));
  }, [manualAddAllergens]);

  const manualAddIndicatorSet = useMemo(() => {
    return new Set(manualAddIndicators.filter(isIndicatorKey));
  }, [manualAddIndicators]);

  const manualExcludeAllergenSet = useMemo(() => {
    return new Set(manualExcludeAllergens.filter(isAllergenKey));
  }, [manualExcludeAllergens]);

  const manualExcludeIndicatorSet = useMemo(() => {
    return new Set(manualExcludeIndicators.filter(isIndicatorKey));
  }, [manualExcludeIndicators]);

  const effectiveAllergenSet = useMemo(() => {
    const merged = new Set([...inheritedAllergenSet, ...manualAddAllergenSet]);
    manualExcludeAllergenSet.forEach((key) => merged.delete(key));
    return merged;
  }, [inheritedAllergenSet, manualAddAllergenSet, manualExcludeAllergenSet]);

  const effectiveIndicatorSet = useMemo(() => {
    const merged = new Set([...inheritedIndicatorSet, ...manualAddIndicatorSet]);
    manualExcludeIndicatorSet.forEach((key) => merged.delete(key));
    return merged;
  }, [inheritedIndicatorSet, manualAddIndicatorSet, manualExcludeIndicatorSet]);

  const orderedInheritedAllergens = useMemo(
    () => resolveOrdered(inheritedAllergenSet, ALLERGENS),
    [inheritedAllergenSet],
  );
  const orderedEffectiveAllergens = useMemo(
    () => resolveOrdered(effectiveAllergenSet, ALLERGENS),
    [effectiveAllergenSet],
  );
  const orderedInheritedIndicators = useMemo(
    () => resolveOrdered(inheritedIndicatorSet, INDICATORS),
    [inheritedIndicatorSet],
  );
  const orderedEffectiveIndicators = useMemo(
    () => resolveOrdered(effectiveIndicatorSet, INDICATORS),
    [effectiveIndicatorSet],
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header className="space-y-1">
          <h4 className="text-sm font-semibold text-white">Alérgenos</h4>
          <p className="text-xs text-slate-400">Marca los alérgenos aplicables.</p>
        </header>
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-500">Heredados</p>
          {orderedInheritedAllergens.length === 0 ? (
            <p className="text-xs text-slate-500">Sin alérgenos heredados.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orderedInheritedAllergens.map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200"
                >
                  {allergenLabelMap.get(key) ?? key}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-500">Efectivos</p>
          {orderedEffectiveAllergens.length === 0 ? (
            <p className="text-xs text-slate-500">Sin alérgenos efectivos.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orderedEffectiveAllergens.map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100"
                >
                  {allergenLabelMap.get(key) ?? key}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALLERGENS.map((allergen) => {
            const isActive = effectiveAllergenSet.has(allergen.key);
            return (
              <label
                key={allergen.key}
                className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-400"
                  checked={isActive}
                  onChange={() =>
                    toggleManualSelection({
                      key: allergen.key,
                      inheritedSet: inheritedAllergenSet,
                      effectiveSet: effectiveAllergenSet,
                      manualAdd: manualAddAllergens,
                      manualExclude: manualExcludeAllergens,
                      setManualAdd: setManualAddAllergens,
                      setManualExclude: setManualExcludeAllergens,
                    })
                  }
                />
                {allergen.label}
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header className="space-y-1">
          <h4 className="text-sm font-semibold text-white">Indicadores</h4>
          <p className="text-xs text-slate-400">Marca los indicadores aplicables.</p>
        </header>
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-500">Heredados</p>
          {orderedInheritedIndicators.length === 0 ? (
            <p className="text-xs text-slate-500">Sin indicadores heredados.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orderedInheritedIndicators.map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200"
                >
                  {indicatorLabelMap.get(key) ?? key}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-500">Efectivos</p>
          {orderedEffectiveIndicators.length === 0 ? (
            <p className="text-xs text-slate-500">Sin indicadores efectivos.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orderedEffectiveIndicators.map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-sky-400/70 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100"
                >
                  {indicatorLabelMap.get(key) ?? key}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {INDICATORS.map((indicator) => {
            const isActive = effectiveIndicatorSet.has(indicator.key);
            return (
              <label
                key={indicator.key}
                className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-400"
                  checked={isActive}
                  onChange={() =>
                    toggleManualSelection({
                      key: indicator.key,
                      inheritedSet: inheritedIndicatorSet,
                      effectiveSet: effectiveIndicatorSet,
                      manualAdd: manualAddIndicators,
                      manualExclude: manualExcludeIndicators,
                      setManualAdd: setManualAddIndicators,
                      setManualExclude: setManualExcludeIndicators,
                    })
                  }
                />
                {indicator.label}
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
