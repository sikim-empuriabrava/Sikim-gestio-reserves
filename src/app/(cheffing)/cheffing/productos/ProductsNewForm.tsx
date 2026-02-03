'use client';

import { useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { Ingredient, Unit, UnitDimension } from '@/lib/cheffing/types';
import { ALLERGENS, INDICATORS } from '@/lib/cheffing/allergensIndicators';
import { toAllergenKeys, toIndicatorKeys } from '@/lib/cheffing/allergensHelpers';
import { ImageUploader } from '@/app/(cheffing)/cheffing/components/ImageUploader';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type ProductFormState = {
  name: string;
  categories: string[];
  stock_unit_code: string;
  stock_qty: string;
  min_stock_qty: string;
  max_stock_qty: string;
  reference: string;
  purchase_unit_code: string;
  purchase_pack_qty: string;
  purchase_price: string;
  waste_pct: string;
  allergens: string[];
  indicators: string[];
};

type ProductsNewFormProps = {
  units: Unit[];
  initialProduct?: Ingredient | null;
  productId?: string;
  canManageImages: boolean;
};

const dimensionLabels: Record<UnitDimension, string> = {
  mass: 'Peso',
  volume: 'Volumen',
  unit: 'Unidad',
};

const normalizeTag = (value: string) => value.trim().toLowerCase();

const sanitizeStringArray = (values: string[]) => {
  const cleaned = values.map((value) => normalizeTag(value)).filter(Boolean);
  return Array.from(new Set(cleaned));
};

export function ProductsNewForm({ units, initialProduct, productId, canManageImages }: ProductsNewFormProps) {
  const router = useRouter();
  const hasUnits = units.length > 0;
  const isEditing = Boolean(productId);
  const [error, setError] = useState<string | null>(null);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const unitByCode = useMemo(() => {
    return new Map<string, Unit>(units.map((unit) => [unit.code.toLowerCase(), unit] as const));
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

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => a.code.localeCompare(b.code));
  }, [units]);

  const existingImageUrl = useMemo(() => {
    if (!initialProduct?.image_path) return null;
    const { data } = supabase.storage.from('cheffing-images').getPublicUrl(initialProduct.image_path);
    const cacheKey = initialProduct.updated_at ?? Date.now().toString();
    return `${data.publicUrl}?v=${encodeURIComponent(cacheKey)}`;
  }, [initialProduct?.image_path, initialProduct?.updated_at, supabase]);

  const initialStockUnitCode = initialProduct?.stock_unit_code ?? '';
  const initialStockDimension =
    unitByCode.get(initialStockUnitCode.toLowerCase())?.dimension ?? units[0]?.dimension ?? 'mass';
  const initialStockUnitCodeResolved =
    initialStockUnitCode ||
    units.find((unit) => unit.dimension === initialStockDimension)?.code ||
    '';

  const [stockUnitDimension, setStockUnitDimension] = useState<UnitDimension>(initialStockDimension);
  const [formState, setFormState] = useState<ProductFormState>({
    name: initialProduct?.name ?? '',
    categories: initialProduct?.categories ?? [],
    stock_unit_code: initialStockUnitCodeResolved,
    stock_qty: initialProduct ? String(initialProduct.stock_qty) : '0',
    min_stock_qty:
      initialProduct?.min_stock_qty !== null && initialProduct?.min_stock_qty !== undefined
        ? String(initialProduct.min_stock_qty)
        : '',
    max_stock_qty:
      initialProduct?.max_stock_qty !== null && initialProduct?.max_stock_qty !== undefined
        ? String(initialProduct.max_stock_qty)
        : '',
    reference: initialProduct?.reference ?? '',
    purchase_unit_code: initialProduct?.purchase_unit_code ?? units[0]?.code ?? '',
    purchase_pack_qty: initialProduct ? String(initialProduct.purchase_pack_qty) : '1',
    purchase_price: initialProduct ? String(initialProduct.purchase_price) : '0',
    waste_pct: initialProduct ? String((initialProduct.waste_pct * 100).toFixed(2)) : '0',
    allergens: initialProduct?.allergens ?? [],
    indicators: initialProduct?.indicators ?? [],
  });

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

  const ensureOptionalAmount = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return null;
    }
    return numericValue;
  };

  const handleAddCategory = (value: string) => {
    const normalized = normalizeTag(value);
    if (!normalized) return;
    setFormState((prev) => {
      const updated = sanitizeStringArray([...prev.categories, normalized]);
      return { ...prev, categories: updated };
    });
    setCategoryInput('');
  };

  const handleCategoryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddCategory(categoryInput);
    }
  };

  const handleRemoveCategory = (category: string) => {
    setFormState((prev) => ({
      ...prev,
      categories: prev.categories.filter((value) => value !== category),
    }));
  };

  const toggleCode = (field: 'allergens' | 'indicators', code: string) => {
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

  const handleStockDimensionChange = (dimension: UnitDimension) => {
    setStockUnitDimension(dimension);
    const unitsInDimension = unitsByDimension.get(dimension) ?? [];
    setFormState((prev) => ({
      ...prev,
      stock_unit_code: unitsInDimension[0]?.code ?? '',
    }));
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setImageWarning(null);
    setIsSubmitting(true);

    try {
      if (!formState.name.trim()) {
        throw new Error('El nombre es obligatorio.');
      }

      if (!hasUnits) {
        throw new Error('Configura unidades antes de crear productos.');
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

      const stockQtyValue = ensureValidAmount(formState.stock_qty, { allowZero: true });
      if (stockQtyValue === null) {
        throw new Error('El stock actual debe ser un número válido.');
      }

      const minStockValue = ensureOptionalAmount(formState.min_stock_qty);
      if (formState.min_stock_qty.trim() && minStockValue === null) {
        throw new Error('El stock mínimo debe ser un número válido.');
      }

      const maxStockValue = ensureOptionalAmount(formState.max_stock_qty);
      if (formState.max_stock_qty.trim() && maxStockValue === null) {
        throw new Error('El stock máximo debe ser un número válido.');
      }

      if (minStockValue !== null && maxStockValue !== null && maxStockValue < minStockValue) {
        throw new Error('El stock máximo no puede ser menor que el mínimo.');
      }

      const categories = sanitizeStringArray(formState.categories);
      const allergenCodes = toAllergenKeys(sanitizeStringArray(formState.allergens));
      const indicatorCodes = toIndicatorKeys(sanitizeStringArray(formState.indicators));
      const reference = formState.reference.trim();
      const stockUnitCode = formState.stock_unit_code.trim();

      const payload = {
        name: formState.name.trim(),
        purchase_unit_code: formState.purchase_unit_code.trim(),
        purchase_pack_qty: packQtyValue,
        purchase_price: priceValue,
        waste_pct: wastePctValue,
        categories,
        reference: reference ? reference : null,
        stock_unit_code: stockUnitCode ? stockUnitCode : null,
        stock_qty: stockQtyValue,
        min_stock_qty: minStockValue,
        max_stock_qty: maxStockValue,
        allergens: allergenCodes,
        indicators: indicatorCodes,
      };

      const response = await fetch(
        isEditing && productId ? `/api/cheffing/ingredients/${productId}` : '/api/cheffing/ingredients',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const responsePayload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Ya existe un producto con ese nombre.');
        }
        throw new Error(responsePayload?.error ?? 'Error guardando producto');
      }

      const createdId =
        !isEditing && responsePayload?.id && typeof responsePayload.id === 'string' ? responsePayload.id : null;
      const targetId = isEditing ? productId : createdId;

      if (targetId && imageFile && canManageImages) {
        let uploadedPath: string | null = null;
        const previousPath = initialProduct?.image_path ?? null;
        try {
          const extension = imageFile.type === 'image/webp' ? 'webp' : 'jpg';
          const path = `ingredients/${targetId}/main.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from('cheffing-images')
            .upload(path, imageFile, { upsert: true, contentType: imageFile.type });

          if (uploadError) {
            throw new Error('Error subiendo la imagen del producto.');
          }

          uploadedPath = path;
          const patchResponse = await fetch(`/api/cheffing/ingredients/${targetId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_path: path }),
          });

          if (!patchResponse.ok) {
            throw new Error('Error guardando la imagen del producto.');
          }

          if (previousPath && previousPath !== path) {
            await supabase.storage.from('cheffing-images').remove([previousPath]);
          }
          setImageFile(null);
        } catch (imageError) {
          if (uploadedPath) {
            await supabase.storage.from('cheffing-images').remove([uploadedPath]);
          }
          setImageWarning(
            imageError instanceof Error ? imageError.message : 'No se pudo guardar la imagen del producto.',
          );
        }
      }

      router.push('/cheffing/productos');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const unitsForStockDimension = unitsByDimension.get(stockUnitDimension) ?? [];

  const handleDeleteImage = async () => {
    if (!initialProduct?.image_path) return;
    setImageWarning(null);
    setIsSubmitting(true);
    try {
      const confirmed = window.confirm('¿Seguro que quieres eliminar la imagen?');
      if (!confirmed) {
        return;
      }
      const { error: removeError } = await supabase.storage
        .from('cheffing-images')
        .remove([initialProduct.image_path]);
      if (removeError) {
        throw new Error('Error eliminando la imagen del producto.');
      }
      const patchResponse = await fetch(`/api/cheffing/ingredients/${initialProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_path: null }),
      });
      if (!patchResponse.ok) {
        throw new Error('Error guardando la eliminación de la imagen.');
      }
      router.refresh();
    } catch (err) {
      setImageWarning(err instanceof Error ? err.message : 'No se pudo eliminar la imagen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submitProduct} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">
          {isEditing ? 'Editar ficha de producto' : 'Nuevo producto'}
        </h3>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        {imageWarning ? <p className="text-sm text-amber-300">{imageWarning}</p> : null}
        {!hasUnits ? (
          <p className="text-sm text-amber-300">Configura unidades antes de crear productos.</p>
        ) : null}
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header>
          <h4 className="text-sm font-semibold text-white">Datos básicos</h4>
          <p className="text-xs text-slate-400">Información principal del producto.</p>
        </header>
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
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header>
          <h4 className="text-sm font-semibold text-white">Imagen</h4>
          <p className="text-xs text-slate-400">Opcional. Puedes actualizarla cuando quieras.</p>
        </header>
        {canManageImages || existingImageUrl ? (
          <div className="space-y-3">
            <ImageUploader
              label="Imagen del producto"
              initialUrl={existingImageUrl}
              onFileReady={setImageFile}
              disabled={isSubmitting}
              readOnly={!canManageImages}
            />
            {canManageImages && initialProduct?.image_path ? (
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
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header>
          <h4 className="text-sm font-semibold text-white">Categorías</h4>
          <p className="text-xs text-slate-400">Etiquetas internas para organizar productos.</p>
        </header>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-2 text-sm text-slate-300">
            Añadir etiqueta
            <input
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={categoryInput}
              onChange={(event) => setCategoryInput(event.target.value)}
              onKeyDown={handleCategoryKeyDown}
              placeholder="Ej. frescos"
            />
          </label>
          <button
            type="button"
            onClick={() => handleAddCategory(categoryInput)}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200"
          >
            Añadir tag
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formState.categories.length === 0 ? (
            <p className="text-xs text-slate-500">Sin etiquetas todavía.</p>
          ) : (
            formState.categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleRemoveCategory(category)}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200"
              >
                {category} ✕
              </button>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header>
          <h4 className="text-sm font-semibold text-white">Almacén</h4>
          <p className="text-xs text-slate-400">Stock y unidad de uso interno.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-6">
          <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-2">
            Stock actual
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.stock_qty}
              onChange={(event) => setFormState((prev) => ({ ...prev, stock_qty: event.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Tipo
            <select
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={stockUnitDimension}
              onChange={(event) => handleStockDimensionChange(event.target.value as UnitDimension)}
              disabled={!hasUnits}
            >
              {(['mass', 'volume', 'unit'] as UnitDimension[]).map((dimension) => (
                <option key={dimension} value={dimension}>
                  {dimensionLabels[dimension]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Unidad
            <select
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.stock_unit_code}
              onChange={(event) => setFormState((prev) => ({ ...prev, stock_unit_code: event.target.value }))}
              disabled={!hasUnits}
            >
              {unitsForStockDimension.length === 0 ? (
                <option value="">Sin unidades</option>
              ) : (
                unitsForStockDimension.map((unit) => (
                  <option key={unit.code} value={unit.code}>
                    {unit.code} · {unit.name ?? unit.code}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Stock mínimo
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.min_stock_qty}
              onChange={(event) => setFormState((prev) => ({ ...prev, min_stock_qty: event.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Stock máximo
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.max_stock_qty}
              onChange={(event) => setFormState((prev) => ({ ...prev, max_stock_qty: event.target.value }))}
            />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Referencia
          <input
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
            value={formState.reference}
            onChange={(event) => setFormState((prev) => ({ ...prev, reference: event.target.value }))}
            placeholder="SKU o referencia interna"
          />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header>
          <h4 className="text-sm font-semibold text-white">Compra y coste</h4>
          <p className="text-xs text-slate-400">Formato de compra y merma.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-5">
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
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header>
          <h4 className="text-sm font-semibold text-white">Alérgenos</h4>
          <p className="text-xs text-slate-400">Selecciona los alérgenos asociados.</p>
        </header>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALLERGENS.map((allergen) => {
            const isActive = formState.allergens.includes(allergen.key);
            return (
              <button
                key={allergen.key}
                type="button"
                onClick={() => toggleCode('allergens', allergen.key)}
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
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <header>
          <h4 className="text-sm font-semibold text-white">Indicadores</h4>
          <p className="text-xs text-slate-400">Destaca características del producto.</p>
        </header>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {INDICATORS.map((indicator) => {
            const isActive = formState.indicators.includes(indicator.key);
            return (
              <button
                key={indicator.key}
                type="button"
                onClick={() => toggleCode('indicators', indicator.key)}
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
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEditing ? 'Guardar cambios' : 'Guardar producto'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/cheffing/productos')}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
