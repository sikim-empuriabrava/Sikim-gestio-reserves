'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';

import {
  runProcurementIntakeFlow,
  type ProcurementIntakeStep,
} from '@/components/procurement/SharedProcurementDocumentIntake';
import {
  documentKindLabel,
  PROCUREMENT_SOURCE_FILE_ACCEPT_ATTRIBUTE,
  PROCUREMENT_SOURCE_IMAGE_FILE_ACCEPT_ATTRIBUTE,
  type ProcurementDocumentKind,
} from '@/lib/cheffing/procurement';

type BatchQueueStatus = 'pending' | ProcurementIntakeStep | 'completed' | 'failed';

type BatchQueueItem = {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  previewUrl: string | null;
  isImage: boolean;
  documentKind: ProcurementDocumentKind;
  status: BatchQueueStatus;
  error: string | null;
  documentId: string | null;
};

type SharedProcurementBatchIntakeProps = {
  title?: string;
  description?: string;
  initialDocumentKind?: ProcurementDocumentKind;
  runOcrAfterUpload?: boolean;
  className?: string;
  completionMessage?: string;
  possibleDuplicateByDocumentId?: Map<string, boolean>;
  variant?: 'default' | 'warm';
};

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

function revokePreviewUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

export function SharedProcurementBatchIntake({
  title = 'Intake documental OCR (1 o varios archivos)',
  description =
    'Usa una sola entrada para añadir uno o varios archivos. Cada archivo crea borrador, sube original y ejecuta OCR de forma secuencial.',
  initialDocumentKind = 'delivery_note',
  runOcrAfterUpload = true,
  className,
  completionMessage = 'Lote finalizado. Se refresca la bandeja para mostrar nuevos borradores sin redirigir al detalle.',
  possibleDuplicateByDocumentId,
  variant = 'default',
}: SharedProcurementBatchIntakeProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const batchQueueRef = useRef<BatchQueueItem[]>([]);
  const [batchDocumentKind, setBatchDocumentKind] = useState<ProcurementDocumentKind>(initialDocumentKind);
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const isWarm = variant === 'warm';

  const batchSummary = useMemo(() => {
    const summary = {
      total: batchQueue.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
    };

    for (const item of batchQueue) {
      if (item.status === 'pending') summary.pending += 1;
      else if (item.status === 'completed') summary.completed += 1;
      else if (item.status === 'failed') summary.failed += 1;
      else summary.inProgress += 1;
    }

    return summary;
  }, [batchQueue]);

  const hasBatchItems = batchQueue.length > 0;
  const isBatchFinished = hasBatchItems && !isBatchRunning && batchSummary.pending === 0 && batchSummary.inProgress === 0;

  useEffect(() => {
    batchQueueRef.current = batchQueue;
  }, [batchQueue]);

  useEffect(() => {
    return () => {
      batchQueueRef.current.forEach((item) => revokePreviewUrl(item.previewUrl));
    };
  }, []);

  function addBatchFiles(files: FileList | null) {
    if (!files?.length || isBatchRunning) return;

    const queueItems: BatchQueueItem[] = Array.from(files).map((file) => {
      const isImage = file.type.startsWith('image/');

      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        fileName: file.name,
        fileSize: file.size,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        isImage,
        documentKind: batchDocumentKind,
        status: 'pending',
        error: null,
        documentId: null,
      };
    });

    setBatchQueue((current) => [...current, ...queueItems]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    addBatchFiles(event.dataTransfer.files);
  }

  function clearFinishedBatchQueue() {
    if (isBatchRunning) return;
    const removedItems = batchQueue.filter((item) => item.status === 'completed' || item.status === 'failed');
    removedItems.forEach((item) => revokePreviewUrl(item.previewUrl));
    setBatchQueue((current) => current.filter((item) => item.status !== 'completed' && item.status !== 'failed'));
  }

  function removeBatchItem(itemId: string) {
    if (isBatchRunning) return;
    const removedItem = batchQueue.find((item) => item.id === itemId);
    revokePreviewUrl(removedItem?.previewUrl ?? null);
    setBatchQueue((current) => current.filter((item) => item.id !== itemId));
  }

  async function runBatchUpload() {
    if (isBatchRunning) return;
    const pendingItems = batchQueue.filter((item) => item.status === 'pending');
    if (!pendingItems.length) return;

    setIsBatchRunning(true);
    for (const pendingItem of pendingItems) {
      try {
        setBatchQueue((current) =>
          current.map((item) =>
            item.id === pendingItem.id
              ? {
                  ...item,
                  status: 'creating_draft',
                  error: null,
                }
              : item,
          ),
        );

        const result = await runProcurementIntakeFlow({
          file: pendingItem.file,
          documentKind: pendingItem.documentKind,
          runOcrAfterUpload,
          onStepChange: (step) => {
            if (!step) return;
            setBatchQueue((current) =>
              current.map((item) =>
                item.id === pendingItem.id
                  ? {
                      ...item,
                      status: step,
                    }
                  : item,
              ),
            );
          },
        });

        setBatchQueue((current) =>
          current.map((item) =>
            item.id === pendingItem.id
              ? {
                  ...item,
                  status: 'completed',
                  error: null,
                  documentId: result.documentId,
                }
              : item,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        const erroredDocumentId = (err as Error & { documentId?: string })?.documentId ?? null;
        setBatchQueue((current) =>
          current.map((item) =>
            item.id === pendingItem.id
              ? {
                  ...item,
                  status: 'failed',
                  error: message,
                  documentId: erroredDocumentId ?? item.documentId,
                }
              : item,
          ),
        );
      }
    }

    setIsBatchRunning(false);
    router.refresh();
  }

  const containerClassName =
    className ??
    (isWarm
      ? 'operational-surface space-y-4 rounded-2xl border border-[#4a3f32]/70 bg-[#181715] p-5 text-[#efe8dc] shadow-[0_24px_80px_-58px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.04)]'
      : 'space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4');
  const selectClassName = isWarm
    ? 'rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3.5 py-2.5 text-[#f4ede3] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15 disabled:cursor-not-allowed disabled:text-[#7f766b]'
    : 'rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500';
  const processClassName = isWarm
    ? 'min-h-11 rounded-xl border border-[#d6a76e]/60 bg-[#2a1e16]/90 px-4 py-2.5 text-sm font-semibold text-[#f3c98d] transition duration-200 hover:-translate-y-0.5 hover:border-[#bd8145]/80 hover:bg-[#3a2618] disabled:cursor-not-allowed disabled:border-[#4a3f32]/70 disabled:text-[#7f766b]'
    : 'min-h-11 rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500';
  const secondaryActionClassName = isWarm
    ? 'inline-flex min-h-11 items-center justify-center rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 px-4 py-2.5 text-sm font-semibold text-[#efe8dc] transition duration-200 hover:-translate-y-0.5 hover:border-[#8b6a43]/75 hover:bg-[#211f1b] disabled:cursor-not-allowed disabled:border-[#4a3f32]/70 disabled:text-[#7f766b]'
    : 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500';
  const dropzoneClassName = isWarm
    ? `group cursor-pointer rounded-2xl border border-dashed p-5 text-left transition duration-200 ${
        isDraggingOver
          ? 'border-[#d6a76e]/80 bg-[#2a1e16]/80'
          : 'border-[#6f4d2a]/75 bg-[#151412]/70 hover:border-[#d6a76e]/60 hover:bg-[#1f1b16]/90'
      }`
    : `group cursor-pointer rounded-2xl border border-dashed p-5 text-left transition duration-200 ${
        isDraggingOver
          ? 'border-sky-400/80 bg-sky-500/10'
          : 'border-slate-700 bg-slate-950/35 hover:border-slate-500 hover:bg-slate-900/45'
      }`;

  return (
    <div className={containerClassName}>
      <div className="space-y-1">
        <h3 className={isWarm ? 'text-lg font-semibold text-[#f6f0e8]' : 'text-sm font-semibold text-white'}>{title}</h3>
        <p className={isWarm ? 'max-w-3xl text-sm leading-6 text-[#b9aea1]' : 'text-xs text-slate-400'}>{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-center">
        <select
          value={batchDocumentKind}
          onChange={(event) => setBatchDocumentKind(event.target.value as ProcurementDocumentKind)}
          disabled={isBatchRunning}
          className={selectClassName}
        >
          <option value="delivery_note">Albarán</option>
          <option value="invoice">Factura</option>
        </select>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isBatchRunning}
            className={secondaryActionClassName}
          >
            Hacer foto
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBatchRunning}
            className={secondaryActionClassName}
          >
            Galería / archivo
          </button>
        </div>

        <button
          type="button"
          disabled={isBatchRunning || batchSummary.pending === 0}
          onClick={runBatchUpload}
          className={processClassName}
        >
          {isBatchRunning ? 'Procesando lote...' : 'Procesar lote'}
        </button>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-disabled={isBatchRunning}
        onClick={() => {
          if (!isBatchRunning) fileInputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (isBatchRunning) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isBatchRunning) setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={dropzoneClassName}
      >
        <div className="space-y-2">
          <p className={isWarm ? 'text-base font-semibold text-[#f6f0e8]' : 'text-base font-semibold text-white'}>
            Haz una foto o sube una factura/albarán/ticket
          </p>
          <p className={isWarm ? 'text-sm leading-6 text-[#b9aea1]' : 'text-sm leading-6 text-slate-400'}>
            PDF, JPG, PNG o WEBP. En móvil, toca aquí para abrir cámara, galería o archivos según el navegador.
          </p>
          <p className={isWarm ? 'text-xs text-[#8f8578]' : 'text-xs text-slate-500'}>
            {hasBatchItems
              ? `${batchSummary.total} archivo${batchSummary.total === 1 ? '' : 's'} en cola. Revisa abajo el estado antes de procesar.`
              : 'Aún no has seleccionado ningún archivo.'}
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={PROCUREMENT_SOURCE_FILE_ACCEPT_ATTRIBUTE}
        disabled={isBatchRunning}
        className="hidden"
        onChange={(event) => {
          addBatchFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={PROCUREMENT_SOURCE_IMAGE_FILE_ACCEPT_ATTRIBUTE}
        capture="environment"
        disabled={isBatchRunning}
        className="hidden"
        onChange={(event) => {
          addBatchFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />

      <p className={isWarm ? 'text-xs leading-5 text-[#8f8578]' : 'text-xs text-slate-500'}>
        Formatos permitidos: PDF, JPG, PNG o WEBP. Cada archivo conserva su estado y errores parciales.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={isWarm ? 'rounded-full border border-[#4a3f32]/70 bg-[#151412]/70 px-2.5 py-1.5 text-[#d8cfc2]' : 'rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-200'}>Total: {batchSummary.total}</span>
        <span className={isWarm ? 'rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-amber-200' : 'rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-200'}>Pendientes: {batchSummary.pending}</span>
        <span className={isWarm ? 'rounded-full border border-[#b77b3e]/40 bg-[#7d5932]/18 px-2.5 py-1.5 text-[#f1c98f]' : 'rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-sky-100'}>En proceso: {batchSummary.inProgress}</span>
        <span className={isWarm ? 'rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-200' : 'rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-100'}>Completados: {batchSummary.completed}</span>
        <span className={isWarm ? 'rounded-full border border-rose-500/35 bg-rose-500/10 px-2.5 py-1.5 text-rose-200' : 'rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-100'}>Fallidos: {batchSummary.failed}</span>
        <button
          type="button"
          onClick={clearFinishedBatchQueue}
          disabled={isBatchRunning || (!batchSummary.completed && !batchSummary.failed)}
          className={isWarm ? 'ml-auto rounded-xl border border-[#6f4d2a]/70 bg-[#2a1e16]/80 px-3 py-1.5 text-xs font-semibold text-[#f3c98d] disabled:cursor-not-allowed disabled:border-[#4a3f32]/70 disabled:text-[#7f766b]' : 'rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500'}
        >
          Limpiar finalizados
        </button>
      </div>

      {isBatchFinished ? <p className={isWarm ? 'text-xs text-[#a99d90]' : 'text-xs text-slate-400'}>{completionMessage}</p> : null}

      <div className="grid gap-2 md:hidden">
        {batchQueue.length === 0 ? (
          <div className={isWarm ? 'rounded-xl border border-[#3c342a]/80 p-4 text-sm text-[#a99d90]' : 'rounded-xl border border-slate-800/80 p-4 text-sm text-slate-400'}>
            Sin archivos en cola. Añade uno o varios para lanzar el lote OCR.
          </div>
        ) : null}
        {batchQueue.map((item) => (
          <article key={item.id} className={isWarm ? 'space-y-3 rounded-xl border border-[#3c342a]/80 p-4' : 'space-y-3 rounded-xl border border-slate-800/80 p-4'}>
            <div className={isWarm ? 'overflow-hidden rounded-xl border border-[#3c342a]/80 bg-[#12110f]/70' : 'overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40'}>
              {item.isImage && item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt={`Vista previa de ${item.fileName}`} className="h-44 w-full object-contain" />
              ) : (
                <div className={isWarm ? 'flex h-24 items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] text-[#a99d90]' : 'flex h-24 items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'}>
                  PDF
                </div>
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={isWarm ? 'break-words text-sm font-semibold text-[#f6f0e8]' : 'break-words text-sm font-semibold text-white'}>{item.fileName}</p>
                <p className={isWarm ? 'mt-1 text-xs text-[#a99d90]' : 'mt-1 text-xs text-slate-400'}>
                  {documentKindLabel(item.documentKind)} · {formatFileSize(item.fileSize)}
                </p>
              </div>
              <span className={isWarm ? 'shrink-0 rounded-full border border-[#4a3f32]/70 bg-[#151412]/70 px-2 py-1 text-xs text-[#f6f0e8]' : 'shrink-0 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100'}>
                {item.status === 'pending'
                  ? 'Pendiente'
                  : item.status === 'creating_draft'
                    ? 'Creando draft'
                    : item.status === 'uploading_file'
                      ? 'Subiendo'
                      : item.status === 'running_ocr'
                        ? 'OCR'
                        : item.status === 'completed'
                          ? 'Completado'
                          : 'Fallido'}
              </span>
            </div>
            {item.status === 'pending' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => removeBatchItem(item.id)}
                  disabled={isBatchRunning}
                  className={isWarm ? 'inline-flex min-h-10 items-center rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:border-[#4a3f32]/70 disabled:text-[#7f766b]' : 'inline-flex min-h-10 items-center rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500'}
                >
                  Quitar
                </button>
              </div>
            ) : null}
            {item.documentId ? (
              <Link href={`/cheffing/compras/${item.documentId}`} className={isWarm ? 'inline-flex min-h-10 items-center rounded-xl border border-[#6f4d2a]/70 px-3 text-sm font-semibold text-[#f3c98d]' : 'inline-flex min-h-10 items-center rounded-xl border border-slate-700 px-3 text-sm font-semibold text-sky-300'}>
                Abrir documento
              </Link>
            ) : null}
            {item.documentId && item.status === 'completed' && possibleDuplicateByDocumentId?.get(item.documentId) ? (
              <span className="inline-flex rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-100">
                Posible duplicado
              </span>
            ) : null}
            {item.error ? <p className="text-xs text-rose-300">{item.error}</p> : null}
          </article>
        ))}
      </div>

      <div className={isWarm ? 'hidden overflow-x-auto rounded-xl border border-[#3c342a]/80 md:block' : 'hidden overflow-x-auto rounded-xl border border-slate-800/80 md:block'}>
        <table className={isWarm ? 'w-full min-w-[900px] text-left text-sm text-[#d8cfc2]' : 'w-full min-w-[900px] text-left text-sm text-slate-200'}>
          <thead className={isWarm ? 'bg-[#12110f]/80 text-xs uppercase text-[#a99d90]' : 'bg-slate-950/70 text-xs uppercase text-slate-400'}>
            <tr>
              <th className="px-4 py-3">Archivo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Estado cola</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {batchQueue.length === 0 ? (
              <tr className={isWarm ? 'border-t border-[#3c342a]/70' : 'border-t border-slate-800/60'}>
                <td className={isWarm ? 'px-4 py-8 text-center text-sm text-[#a99d90]' : 'px-4 py-5 text-sm text-slate-400'} colSpan={5}>
                  Sin archivos en cola. Añade uno o varios para lanzar el lote OCR.
                </td>
              </tr>
            ) : null}
            {batchQueue.map((item) => (
              <tr key={item.id} className={isWarm ? 'border-t border-[#3c342a]/70 align-top' : 'border-t border-slate-800/60 align-top'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={isWarm ? 'flex h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#3c342a]/80 bg-[#12110f]/70' : 'flex h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50'}>
                      {item.isImage && item.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt={`Vista previa de ${item.fileName}`} className="h-full w-full object-cover" />
                      ) : (
                        <span className={isWarm ? 'm-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a99d90]' : 'm-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500'}>PDF</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="break-words font-medium">{item.fileName}</p>
                      <p className={isWarm ? 'mt-1 text-xs text-[#8f8578]' : 'mt-1 text-xs text-slate-500'}>{formatFileSize(item.fileSize)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{documentKindLabel(item.documentKind)}</td>
                <td className="px-4 py-3">
                  <span className={isWarm ? 'rounded-full border border-[#4a3f32]/70 bg-[#151412]/70 px-2 py-1 text-xs text-[#f6f0e8]' : 'rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100'}>
                    {item.status === 'pending'
                      ? 'Pendiente'
                      : item.status === 'creating_draft'
                        ? 'Creando draft'
                        : item.status === 'uploading_file'
                          ? 'Subiendo archivo'
                          : item.status === 'running_ocr'
                            ? 'Ejecutando OCR'
                            : item.status === 'completed'
                              ? 'Completado'
                              : 'Fallido'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {item.documentId ? (
                      <Link href={`/cheffing/compras/${item.documentId}`} className={isWarm ? 'text-[#d69c57] underline' : 'text-sky-300 underline'}>
                        Abrir {item.documentId.slice(0, 8)}...
                      </Link>
                    ) : (
                      <span className={isWarm ? 'text-[#8f8578]' : 'text-slate-500'}>-</span>
                    )}
                    {item.documentId && item.status === 'completed' && possibleDuplicateByDocumentId?.get(item.documentId) ? (
                      <span className="inline-flex rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-100">
                        Posible duplicado
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-rose-300">
                  <div className="space-y-2">
                    <p>{item.error ?? '-'}</p>
                    {item.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => removeBatchItem(item.id)}
                        disabled={isBatchRunning}
                        className={isWarm ? 'inline-flex h-8 items-center rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-200 disabled:cursor-not-allowed disabled:border-[#4a3f32]/70 disabled:text-[#7f766b]' : 'inline-flex h-8 items-center rounded-lg border border-rose-500/50 bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500'}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
