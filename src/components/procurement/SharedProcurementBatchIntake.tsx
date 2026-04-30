'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  runProcurementIntakeFlow,
  type ProcurementIntakeStep,
} from '@/components/procurement/SharedProcurementDocumentIntake';
import {
  documentKindLabel,
  PROCUREMENT_SOURCE_FILE_ACCEPT_ATTRIBUTE,
  type ProcurementDocumentKind,
} from '@/lib/cheffing/procurement';

type BatchQueueStatus = 'pending' | ProcurementIntakeStep | 'completed' | 'failed';

type BatchQueueItem = {
  id: string;
  file: File;
  fileName: string;
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
  const [batchDocumentKind, setBatchDocumentKind] = useState<ProcurementDocumentKind>(initialDocumentKind);
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
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

  function addBatchFiles(files: FileList | null) {
    if (!files?.length || isBatchRunning) return;

    const queueItems: BatchQueueItem[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      fileName: file.name,
      documentKind: batchDocumentKind,
      status: 'pending',
      error: null,
      documentId: null,
    }));

    setBatchQueue((current) => [...current, ...queueItems]);
  }

  function clearFinishedBatchQueue() {
    if (isBatchRunning) return;
    setBatchQueue((current) => current.filter((item) => item.status !== 'completed' && item.status !== 'failed'));
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
      ? 'space-y-4 rounded-2xl border border-[#4a3f32]/70 bg-gradient-to-br from-[#1d1b18]/96 via-[#181715]/94 to-[#11100e]/96 p-5 text-[#efe8dc] shadow-[0_24px_80px_-58px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.04)]'
      : 'space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4');
  const selectClassName = isWarm
    ? 'rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3.5 py-2.5 text-[#f4ede3] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15 disabled:cursor-not-allowed disabled:text-[#7f766b]'
    : 'rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500';
  const addFilesClassName = isWarm
    ? 'inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 px-4 py-2.5 text-sm font-semibold text-[#efe8dc] transition duration-200 hover:-translate-y-0.5 hover:border-[#8b6a43]/75 hover:bg-[#211f1b]'
    : 'inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500';
  const processClassName = isWarm
    ? 'rounded-xl border border-[#d6a76e]/60 bg-[#2a1e16]/90 px-4 py-2.5 text-sm font-semibold text-[#f3c98d] transition duration-200 hover:-translate-y-0.5 hover:border-[#bd8145]/80 hover:bg-[#3a2618] disabled:cursor-not-allowed disabled:border-[#4a3f32]/70 disabled:text-[#7f766b]'
    : 'rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500';

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

        <label className={addFilesClassName}>
          Añadir archivos
          <input
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
        </label>

        <button
          type="button"
          disabled={isBatchRunning || batchSummary.pending === 0}
          onClick={runBatchUpload}
          className={processClassName}
        >
          {isBatchRunning ? 'Procesando lote...' : 'Procesar lote'}
        </button>
      </div>

      <p className={isWarm ? 'text-xs leading-5 text-[#8f8578]' : 'text-xs text-slate-500'}>
        Formatos permitidos: PDF, JPG, PNG o WEBP. Cada archivo conserva su estado y errores parciales.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={isWarm ? 'rounded-full border border-[#4a3f32]/70 bg-[#151412]/70 px-2.5 py-1.5 text-[#d8cfc2]' : 'rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-200'}>Total: {batchSummary.total}</span>
        <span className={isWarm ? 'rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-amber-200' : 'rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-200'}>Pendientes: {batchSummary.pending}</span>
        <span className={isWarm ? 'rounded-full border border-sky-500/35 bg-sky-500/10 px-2.5 py-1.5 text-sky-200' : 'rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-sky-100'}>En proceso: {batchSummary.inProgress}</span>
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

      <div className={isWarm ? 'overflow-x-auto rounded-xl border border-[#3c342a]/80' : 'overflow-x-auto rounded-xl border border-slate-800/80'}>
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
                <td className="px-4 py-3">{item.fileName}</td>
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
                <td className="px-4 py-3 text-xs text-rose-300">{item.error ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
