'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { Area } from 'react-easy-crop';

import { ImageCropModal } from '@/app/(cheffing)/cheffing/components/ImageCropModal';

const IMAGE_QUALITY = 0.8;

type ImageUploaderProps = {
  initialUrl?: string | null;
  label?: string;
  onFileReady: (file: File | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  cropSquare?: boolean;
  outputSize?: number;
};

async function loadDataUrlFromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

async function createImage(imageSrc: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = imageSrc;
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

async function cropAndCompressImage({
  imageSrc,
  croppedAreaPixels,
  outputSize,
  baseName,
}: {
  imageSrc: string;
  croppedAreaPixels: Area;
  outputSize: number;
  baseName: string;
}) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo procesar la imagen.');
  }

  context.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  try {
    return await canvasToFile(canvas, 'image/webp', `${baseName}.webp`);
  } catch {
    return await canvasToFile(canvas, 'image/jpeg', `${baseName}.jpg`);
  }
}

export function ImageUploader({
  initialUrl = null,
  label = 'Imagen',
  onFileReady,
  disabled,
  readOnly,
  cropSquare = true,
  outputSize = 1024,
}: ImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('imagen');

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

  const closeCropper = () => {
    setPendingImageSrc(null);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setLocalError(null);

    if (!file) {
      onFileReady(null);
      setPreviewUrl(initialUrl);
      return;
    }

    event.target.value = '';
    setIsProcessing(true);

    try {
      const dataUrl = await loadDataUrlFromFile(file);
      setPendingImageSrc(dataUrl);
      setPendingFileName(file.name.replace(/\.[^/.]+$/, '') || 'imagen');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
      onFileReady(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCropConfirm = async (area: Area) => {
    if (!pendingImageSrc) return;
    setLocalError(null);
    setIsProcessing(true);

    try {
      const cropped = await cropAndCompressImage({
        imageSrc: pendingImageSrc,
        croppedAreaPixels: area,
        outputSize,
        baseName: pendingFileName,
      });
      const nextUrl = URL.createObjectURL(cropped);
      setPreviewUrl(nextUrl);
      onFileReady(cropped);
      closeCropper();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
      onFileReady(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (isProcessing) return 'Procesando imagen...';
    if (readOnly) return 'Vista previa de la imagen.';
    return 'Selecciona una imagen para subir.';
  }, [isProcessing, readOnly]);

  if (readOnly && !previewUrl) {
    return null;
  }

  const cropAspect = cropSquare ? 1 : 4 / 3;

  return (
    <div className="space-y-3">
      {!readOnly ? (
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          {label}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled || isProcessing}
            className="block w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white file:mr-3 file:rounded-full file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-200"
          />
        </label>
      ) : (
        <p className="text-sm font-semibold text-slate-200">{label}</p>
      )}
      <p className="text-xs text-slate-500">{statusLabel}</p>
      {localError ? <p className="text-xs text-rose-400">{localError}</p> : null}
      {previewUrl ? (
        <div className="overflow-hidden rounded-xl border border-slate-800/70">
          <img src={previewUrl} alt="Previsualización de imagen" className="h-40 w-full object-cover" />
        </div>
      ) : (
        !readOnly && (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
            Sin imagen seleccionada.
          </div>
        )
      )}
      {pendingImageSrc ? (
        <ImageCropModal
          imageSrc={pendingImageSrc}
          aspect={cropAspect}
          onCancel={closeCropper}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </div>
  );
}
