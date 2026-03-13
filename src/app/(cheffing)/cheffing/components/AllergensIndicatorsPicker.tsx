'use client';

import { useMemo } from 'react';

import { ALLERGENS, DISH_INDICATORS, PRODUCT_INDICATORS } from '@/lib/cheffing/allergensIndicators';
import { isAllergenKey, isDishIndicatorKey, isProductIndicatorKey } from '@/lib/cheffing/allergensHelpers';

type AllergensIndicatorsPickerProps = {
  inheritedAllergens: string[];
  manualAddAllergens: string[];
  setManualAddAllergens: (value: string[]) => void;
  manualExcludeAllergens: string[];
  setManualExcludeAllergens: (value: string[]) => void;
  inheritedProductIndicators?: string[];
  manualAddIndicators?: string[];
  setManualAddIndicators?: (value: string[]) => void;
  manualExcludeIndicators?: string[];
  setManualExcludeIndicators?: (value: string[]) => void;
  manualDishIndicators?: string[];
  setManualDishIndicators?: (value: string[]) => void;
};

type KeyConfig = { key: string; label: string };

function resolveOrdered(keys: Set<string>, orderedList: readonly KeyConfig[]) {
  return orderedList.map((item) => item.key).filter((key) => keys.has(key));
}

function toggleManualSelection({ key, inheritedSet, effectiveSet, manualAdd, manualExclude, setManualAdd, setManualExclude }: {
  key: string; inheritedSet: Set<string>; effectiveSet: Set<string>; manualAdd: string[]; manualExclude: string[];
  setManualAdd: (value: string[]) => void; setManualExclude: (value: string[]) => void;
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
  manualAddAllergens,
  setManualAddAllergens,
  manualExcludeAllergens,
  setManualExcludeAllergens,
  inheritedProductIndicators,
  manualAddIndicators,
  setManualAddIndicators,
  manualExcludeIndicators,
  setManualExcludeIndicators,
  manualDishIndicators,
  setManualDishIndicators,
}: AllergensIndicatorsPickerProps) {
  const allergenLabelMap = useMemo<Map<string, string>>(
    () => new Map(ALLERGENS.map((x) => [x.key, x.label] as const)),
    [],
  );
  const productIndicatorLabelMap = useMemo<Map<string, string>>(
    () => new Map(PRODUCT_INDICATORS.map((x) => [x.key, x.label] as const)),
    [],
  );

  const inheritedAllergenSet = useMemo(() => new Set(inheritedAllergens.filter(isAllergenKey)), [inheritedAllergens]);
  const manualAddAllergenSet = useMemo(() => new Set(manualAddAllergens.filter(isAllergenKey)), [manualAddAllergens]);
  const manualExcludeAllergenSet = useMemo(
    () => new Set(manualExcludeAllergens.filter(isAllergenKey)),
    [manualExcludeAllergens],
  );
  const effectiveAllergenSet = useMemo(() => {
    const merged = new Set([...inheritedAllergenSet, ...manualAddAllergenSet]);
    manualExcludeAllergenSet.forEach((key) => merged.delete(key));
    return merged;
  }, [inheritedAllergenSet, manualAddAllergenSet, manualExcludeAllergenSet]);

  const orderedInheritedAllergens = useMemo(() => resolveOrdered(inheritedAllergenSet, ALLERGENS), [inheritedAllergenSet]);
  const orderedEffectiveAllergens = useMemo(() => resolveOrdered(effectiveAllergenSet, ALLERGENS), [effectiveAllergenSet]);

  const hasDishMode = Boolean(setManualDishIndicators);

  const inheritedProductIndicatorSet = useMemo(
    () => new Set((inheritedProductIndicators ?? []).filter(isProductIndicatorKey)),
    [inheritedProductIndicators],
  );

  const manualAddIndicatorSet = useMemo(
    () => new Set((manualAddIndicators ?? []).filter(isProductIndicatorKey)),
    [manualAddIndicators],
  );
  const manualExcludeIndicatorSet = useMemo(
    () => new Set((manualExcludeIndicators ?? []).filter(isProductIndicatorKey)),
    [manualExcludeIndicators],
  );
  const effectiveProductIndicatorSet = useMemo(() => {
    const merged = new Set([...inheritedProductIndicatorSet, ...manualAddIndicatorSet]);
    manualExcludeIndicatorSet.forEach((key) => merged.delete(key));
    return merged;
  }, [inheritedProductIndicatorSet, manualAddIndicatorSet, manualExcludeIndicatorSet]);

  const manualDishIndicatorSet = useMemo(
    () => new Set((manualDishIndicators ?? []).filter(isDishIndicatorKey)),
    [manualDishIndicators],
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header className="space-y-1"><h4 className="text-sm font-semibold text-white">Alérgenos</h4></header>
        <div className="space-y-2"><p className="text-xs uppercase text-slate-500">Heredados</p>{orderedInheritedAllergens.length===0?<p className="text-xs text-slate-500">Sin alérgenos heredados.</p>:<div className="flex flex-wrap gap-2">{orderedInheritedAllergens.map((key)=><span key={key} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200">{allergenLabelMap.get(key) ?? key}</span>)}</div>}</div>
        <div className="space-y-2"><p className="text-xs uppercase text-slate-500">Efectivos</p>{orderedEffectiveAllergens.length===0?<p className="text-xs text-slate-500">Sin alérgenos efectivos.</p>:<div className="flex flex-wrap gap-2">{orderedEffectiveAllergens.map((key)=><span key={key} className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">{allergenLabelMap.get(key) ?? key}</span>)}</div>}</div>
        <div className="grid gap-2 sm:grid-cols-2">{ALLERGENS.map((allergen)=>{const isActive=effectiveAllergenSet.has(allergen.key);return <label key={allergen.key} className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"><input type="checkbox" className="h-4 w-4 accent-emerald-400" checked={isActive} onChange={()=>toggleManualSelection({key:allergen.key,inheritedSet:inheritedAllergenSet,effectiveSet:effectiveAllergenSet,manualAdd:manualAddAllergens,manualExclude:manualExcludeAllergens,setManualAdd:setManualAddAllergens,setManualExclude:setManualExcludeAllergens})}/>{allergen.label}</label>;})}</div>
      </section>

      {hasDishMode ? (
        <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
          <header className="space-y-1">
            <h4 className="text-sm font-semibold text-white">Indicadores de plato</h4>
            <p className="text-xs text-slate-400">Los indicadores de producto se heredan; los de plato se marcan manualmente.</p>
          </header>
          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-500">Heredados (producto)</p>
            {resolveOrdered(inheritedProductIndicatorSet, PRODUCT_INDICATORS).length === 0 ? (
              <p className="text-xs text-slate-500">Sin indicadores de producto heredados.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {resolveOrdered(inheritedProductIndicatorSet, PRODUCT_INDICATORS).map((key) => (
                  <span key={key} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200">{productIndicatorLabelMap.get(key) ?? key}</span>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {DISH_INDICATORS.map((indicator) => {
              const active = manualDishIndicatorSet.has(indicator.key);
              return (
                <label key={indicator.key} className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-400"
                    checked={active}
                    onChange={() => {
                      const next = new Set(manualDishIndicatorSet);
                      if (next.has(indicator.key)) next.delete(indicator.key);
                      else next.add(indicator.key);
                      setManualDishIndicators?.(Array.from(next));
                    }}
                  />
                  {indicator.label}
                </label>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
          <header className="space-y-1"><h4 className="text-sm font-semibold text-white">Indicadores</h4></header>
          <div className="space-y-2"><p className="text-xs uppercase text-slate-500">Heredados</p>{resolveOrdered(inheritedProductIndicatorSet, PRODUCT_INDICATORS).length===0?<p className="text-xs text-slate-500">Sin indicadores heredados.</p>:<div className="flex flex-wrap gap-2">{resolveOrdered(inheritedProductIndicatorSet, PRODUCT_INDICATORS).map((key)=><span key={key} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200">{productIndicatorLabelMap.get(key) ?? key}</span>)}</div>}</div>
          <div className="space-y-2"><p className="text-xs uppercase text-slate-500">Efectivos</p>{resolveOrdered(effectiveProductIndicatorSet, PRODUCT_INDICATORS).length===0?<p className="text-xs text-slate-500">Sin indicadores efectivos.</p>:<div className="flex flex-wrap gap-2">{resolveOrdered(effectiveProductIndicatorSet, PRODUCT_INDICATORS).map((key)=><span key={key} className="rounded-full border border-sky-400/70 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100">{productIndicatorLabelMap.get(key) ?? key}</span>)}</div>}</div>
          <div className="grid gap-2 sm:grid-cols-2">{PRODUCT_INDICATORS.map((indicator)=>{const isActive=effectiveProductIndicatorSet.has(indicator.key);return <label key={indicator.key} className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"><input type="checkbox" className="h-4 w-4 accent-sky-400" checked={isActive} onChange={()=>toggleManualSelection({key:indicator.key,inheritedSet:inheritedProductIndicatorSet,effectiveSet:effectiveProductIndicatorSet,manualAdd:manualAddIndicators ?? [],manualExclude:manualExcludeIndicators ?? [],setManualAdd:setManualAddIndicators ?? (()=>{}),setManualExclude:setManualExcludeIndicators ?? (()=>{})})}/>{indicator.label}</label>;})}</div>
        </section>
      )}
    </div>
  );
}
