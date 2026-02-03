'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';

const MAX_IMAGE_SIDE = 1400;
const IMAGE_QUALITY = 0.8;

type ImageUploaderProps = {
  initialUrl?: string | null;
  label?: string;
  onFileReady: (file: File | null) => void;
  disabled?: boolean;
};

async function loadImageFromFile(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = dataUrl;
  });
}

async function canvasToFile(canvas: HTMLCanvasElement, type: string, filename: string) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), type, IMAGE_QUALITY),
  );

  if (!blob) {
    throw new Error('No se pudo procesar la imagen.');
  }

  return new File([blob], filename, { type: blob.type });
}

async function compressImage(file: File) {
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
  const targetWidth = Math.round(image.width * scale);
  const targetHeight = Math.round(image.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo procesar la imagen.');
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const baseName = file.name.replace(/\.[^/.]+$/, '') || 'imagen';

  try {
    return await canvasToFile(canvas, 'image/webp', `${baseName}.webp`);
  } catch {
    return await canvasToFile(canvas, 'image/jpeg', `${baseName}.jpg`);
  }
}

export function ImageUploader({ initialUrl = null, label = 'Imagen', onFileReady, disabled }: ImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  useEffect(() => {
    setPreviewUrl((current) => (current && current !== initialUrl ? current : initialUrl));
  }, [initialUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setLocalError(null);

    if (!file) {
      onFileReady(null);
      setPreviewUrl(initialUrl);
      return;
    }

    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      const nextUrl = URL.createObjectURL(compressed);
      setPreviewUrl(nextUrl);
      onFileReady(compressed);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
      onFileReady(null);
    } finally {
      setIsCompressing(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (isCompressing) return 'Procesando imagen...';
    return 'Selecciona una imagen para subir.';
  }, [isCompressing]);

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        {label}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled}
          className="block w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white file:mr-3 file:rounded-full file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-200"
        />
      </label>
      <p className="text-xs text-slate-500">{statusLabel}</p>
      {localError ? <p className="text-xs text-rose-400">{localError}</p> : null}
      {previewUrl ? (
        <div className="overflow-hidden rounded-xl border border-slate-800/70">
          <img
            src={previewUrl}
            alt="Previsualización de imagen"
            className="h-40 w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
          Sin imagen seleccionada.
        </div>
      )}
    </div>
  );
}
