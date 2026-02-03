'use client';

import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

type ImageCropModalProps = {
  imageSrc: string;
  aspect?: number;
  onCancel: () => void;
  onConfirm: (area: Area) => void;
};

export function ImageCropModal({ imageSrc, aspect = 1, onCancel, onConfirm }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl shadow-black/40"
      >
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-white">Recortar imagen</h2>
          <p className="text-xs text-slate-400">Ajusta el encuadre cuadrado antes de subir.</p>
        </header>
        <div className="relative h-72 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedAreaPixels) => setCroppedArea(croppedAreaPixels)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <label className="flex flex-1 items-center gap-3 text-xs text-slate-300">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (croppedArea) {
                  onConfirm(croppedArea);
                }
              }}
              className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
            >
              Usar recorte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
