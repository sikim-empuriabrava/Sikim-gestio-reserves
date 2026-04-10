'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  PROCUREMENT_SOURCE_FILE_ACCEPT_ATTRIBUTE,
  PROCUREMENT_SOURCE_IMAGE_FILE_ACCEPT_ATTRIBUTE,
  type ProcurementDocumentKind,
} from '@/lib/cheffing/procurement';

export type ProcurementIntakeStep = 'creating_draft' | 'uploading_file' | 'running_ocr';

export type ProcurementIntakeFlowResult = {
  documentId: string | null;
  uploadCompleted: boolean;
  ocrCompleted: boolean;
};

type RunProcurementIntakeFlowOptions = {
  file: File;
  documentKind: ProcurementDocumentKind;
  runOcrAfterUpload: boolean;
  onStepChange?: (step: ProcurementIntakeStep | null) => void;
};

export async function runProcurementIntakeFlow({
  file,
  documentKind,
  runOcrAfterUpload,
  onStepChange,
}: RunProcurementIntakeFlowOptions): Promise<ProcurementIntakeFlowResult> {
  let documentId: string | null = null;
  let uploadCompleted = false;
  let ocrCompleted = false;

  onStepChange?.('creating_draft');
  const today = new Date().toISOString().slice(0, 10);
  const createResponse = await fetch('/api/cheffing/procurement/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_kind: documentKind,
      document_number: '',
      document_date: today,
      supplier_id: null,
    }),
  });

  const createdPayload = await createResponse.json().catch(() => ({}));
  documentId = typeof createdPayload?.id === 'string' ? createdPayload.id : null;
  if (!createResponse.ok || !documentId) {
    throw new Error(createdPayload?.error ?? 'No se pudo crear el borrador');
  }

  const formData = new FormData();
  formData.set('file', file);
  onStepChange?.('uploading_file');
  const uploadResponse = await fetch(`/api/cheffing/procurement/documents/${documentId}/source-file`, {
    method: 'POST',
    body: formData,
  });
  const uploadPayload = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    const uploadError = new Error(uploadPayload?.error ?? 'No se pudo subir el archivo');
    (uploadError as Error & { documentId?: string }).documentId = documentId;
    throw uploadError;
  }
  uploadCompleted = true;

  if (runOcrAfterUpload) {
    onStepChange?.('running_ocr');
    const ocrResponse = await fetch(`/api/cheffing/procurement/documents/${documentId}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_override_lines: false }),
    });
    const ocrPayload = await ocrResponse.json().catch(() => ({}));
    if (!ocrResponse.ok) {
      const ocrError = new Error(ocrPayload?.error ?? 'OCR no disponible para este documento');
      (ocrError as Error & { documentId?: string }).documentId = documentId;
      throw ocrError;
    }
    ocrCompleted = true;
  }

  onStepChange?.(null);

  return {
    documentId,
    uploadCompleted,
    ocrCompleted,
  };
}

type SharedProcurementDocumentIntakeProps = {
  title?: string;
  description?: string;
  initialDocumentKind?: ProcurementDocumentKind;
  runOcrAfterUpload?: boolean;
  redirectToDetailOnSuccess?: boolean;
  showDocumentLinkOnSuccess?: boolean;
  className?: string;
};

export function SharedProcurementDocumentIntake({
  title = 'Entrada documental móvil',
  description = 'Sube una factura o albarán (foto, imagen o PDF) para crear un borrador revisable en Compras.',
  initialDocumentKind = 'delivery_note',
  runOcrAfterUpload = false,
  redirectToDetailOnSuccess = false,
  showDocumentLinkOnSuccess = true,
  className,
}: SharedProcurementDocumentIntakeProps) {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcurementIntakeStep | null>(null);
  const [isUploadCompleted, setIsUploadCompleted] = useState(false);
  const [isOcrCompleted, setIsOcrCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdDocumentId, setCreatedDocumentId] = useState<string | null>(null);
  const [documentKind, setDocumentKind] = useState<ProcurementDocumentKind>(initialDocumentKind);
  const [pendingCameraFile, setPendingCameraFile] = useState<File | null>(null);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
    };
  }, [cameraPreviewUrl]);

  function clearPendingCameraState() {
    if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
    setCameraPreviewUrl(null);
    setPendingCameraFile(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  async function createDraftFromFile(file: File | null) {
    if (!file) return;

    setError(null);
    setCreatedDocumentId(null);
    setIsUploadCompleted(false);
    setIsOcrCompleted(false);
    setIsSubmitting(true);
    setCurrentStep('creating_draft');

    try {
      const result = await runProcurementIntakeFlow({
        file,
        documentKind,
        runOcrAfterUpload,
        onStepChange: setCurrentStep,
      });
      const documentId = result.documentId;
      setIsUploadCompleted(result.uploadCompleted);
      setIsOcrCompleted(result.ocrCompleted);
      setCreatedDocumentId(documentId);
      clearPendingCameraState();
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (redirectToDetailOnSuccess) {
        router.push(`/cheffing/compras/${documentId}`);
        return;
      }

      router.refresh();
    } catch (err) {
      const erroredDocumentId = (err as Error & { documentId?: string })?.documentId ?? null;
      if (erroredDocumentId) setCreatedDocumentId(erroredDocumentId);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCurrentStep(null);
      setIsSubmitting(false);
    }
  }

  function handleCameraFileSelection(file: File | null) {
    if (!file || isSubmitting) return;
    if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
    setError(null);
    setCreatedDocumentId(null);
    setIsUploadCompleted(false);
    setIsOcrCompleted(false);
    setPendingCameraFile(file);
    setCameraPreviewUrl(URL.createObjectURL(file));
  }

  const flowCompletedSuccessfully = Boolean(
    createdDocumentId && !error && isUploadCompleted && (!runOcrAfterUpload || isOcrCompleted),
  );

  return (
    <section className={className ?? 'space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4'}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(180px,220px)_1fr]">
        <select
          value={documentKind}
          onChange={(event) => setDocumentKind(event.target.value as ProcurementDocumentKind)}
          className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
          disabled={isSubmitting}
        >
          <option value="delivery_note">Albarán</option>
          <option value="invoice">Factura</option>
        </select>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isSubmitting}
            className="rounded-full border border-sky-400/60 px-4 py-2 text-sm font-semibold text-sky-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
          >
            Hacer foto
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
          >
            Galería / archivo
          </button>
        </div>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept={PROCUREMENT_SOURCE_IMAGE_FILE_ACCEPT_ATTRIBUTE}
        capture="environment"
        className="hidden"
        onChange={(event) => handleCameraFileSelection(event.target.files?.[0] ?? null)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={PROCUREMENT_SOURCE_FILE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => createDraftFromFile(event.target.files?.[0] ?? null)}
      />

      <p className="text-xs text-slate-500">
        Soportado en este bloque: 1 documento por subida (imagen o PDF). Si haces foto, primero verás una preview local y no se subirá hasta confirmar.
      </p>

      {pendingCameraFile && cameraPreviewUrl ? (
        <div className="space-y-3 rounded-xl border border-slate-800/90 bg-slate-900/50 p-3">
          <p className="text-xs text-amber-200">
            Vista previa de cámara: esta imagen aún no se ha subido. Confirma para iniciar el intake real.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cameraPreviewUrl}
            alt={`Preview de cámara: ${pendingCameraFile.name}`}
            className="max-h-[320px] w-full rounded-lg border border-slate-700 object-contain"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => createDraftFromFile(pendingCameraFile)}
              disabled={isSubmitting}
              className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
            >
              Confirmar y subir
            </button>
            <button
              type="button"
              onClick={() => {
                clearPendingCameraState();
                cameraInputRef.current?.click();
              }}
              disabled={isSubmitting}
              className="rounded-full border border-sky-400/60 px-4 py-2 text-sm font-semibold text-sky-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
            >
              Repetir foto
            </button>
            <button
              type="button"
              onClick={clearPendingCameraState}
              disabled={isSubmitting}
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {isSubmitting ? (
        <p className="text-sm text-sky-300">
          {currentStep === 'creating_draft'
            ? 'Creando borrador…'
            : currentStep === 'uploading_file'
              ? 'Subiendo archivo original…'
              : currentStep === 'running_ocr'
                ? 'Procesando OCR inicial…'
                : runOcrAfterUpload
                  ? 'Subiendo documento, creando borrador y lanzando OCR…'
                  : 'Subiendo documento y creando borrador…'}
        </p>
      ) : null}

      {flowCompletedSuccessfully ? (
        <p className="text-sm text-emerald-300">
          {runOcrAfterUpload
            ? 'Documento enviado y procesado con OCR inicial. Queda como borrador pendiente de revisión por Cheffing.'
            : 'Documento enviado correctamente. Queda como borrador pendiente de revisión por Cheffing.'}
          {showDocumentLinkOnSuccess ? (
            <>
              {' '}
              <Link href={`/cheffing/compras/${createdDocumentId}`} className="underline">
                Abrir en Compras
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-400">
          {createdDocumentId
            ? `El borrador se creó, pero el flujo no terminó correctamente: ${error}`
            : error}
          {createdDocumentId && showDocumentLinkOnSuccess ? (
            <>
              {' '}
              El borrador se ha creado igualmente:{' '}
              <Link href={`/cheffing/compras/${createdDocumentId}`} className="underline">
                abrir documento
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
