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
}: SharedProcurementBatchIntakeProps) {
  const router = useRouter();
  const [batchDocumentKind, setBatchDocumentKind] = useState<ProcurementDocumentKind>(initialDocumentKind);
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

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

  return (
    <div className={className ?? 'space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4'}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-center">
        <select
          value={batchDocumentKind}
          onChange={(event) => setBatchDocumentKind(event.target.value as ProcurementDocumentKind)}
          disabled={isBatchRunning}
          className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500"
        >
          <option value="delivery_note">Albarán</option>
          <option value="invoice">Factura</option>
        </select>

        <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500">
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
          className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
        >
          {isBatchRunning ? 'Procesando lote…' : 'Procesar lote'}
        </button>
      </div>

      <p className="text-xs text-slate-500">Formatos permitidos: PDF, JPG, PNG o WEBP. Cada archivo conserva su estado y errores parciales.</p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-200">Total: {batchSummary.total}</span>
        <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-200">Pendientes: {batchSummary.pending}</span>
        <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-sky-100">En proceso: {batchSummary.inProgress}</span>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-100">Completados: {batchSummary.completed}</span>
        <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-100">Fallidos: {batchSummary.failed}</span>
        <button
          type="button"
          onClick={clearFinishedBatchQueue}
          disabled={isBatchRunning || (!batchSummary.completed && !batchSummary.failed)}
          className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
        >
          Limpiar finalizados
        </button>
      </div>

      {isBatchFinished ? <p className="text-xs text-slate-400">{completionMessage}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="w-full min-w-[900px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
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
              <tr className="border-t border-slate-800/60">
                <td className="px-4 py-5 text-sm text-slate-400" colSpan={5}>
                  Sin archivos en cola. Añade uno o varios para lanzar el lote OCR.
                </td>
              </tr>
            ) : null}
            {batchQueue.map((item) => (
              <tr key={item.id} className="border-t border-slate-800/60 align-top">
                <td className="px-4 py-3">{item.fileName}</td>
                <td className="px-4 py-3">{documentKindLabel(item.documentKind)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100">
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
                      <Link href={`/cheffing/compras/${item.documentId}`} className="text-sky-300 underline">
                        Abrir {item.documentId.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                    {item.documentId && item.status === 'completed' && possibleDuplicateByDocumentId?.get(item.documentId) ? (
                      <span className="inline-flex rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-100">
                        Posible duplicado
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-rose-300">{item.error ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
