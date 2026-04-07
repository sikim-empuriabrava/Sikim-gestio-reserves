'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { type ProcurementDocumentKind } from '@/lib/cheffing/procurement';

type SharedProcurementDocumentIntakeProps = {
  title?: string;
  description?: string;
  runOcrAfterUpload?: boolean;
  redirectToDetailOnSuccess?: boolean;
  showDocumentLinkOnSuccess?: boolean;
  className?: string;
};

export function SharedProcurementDocumentIntake({
  title = 'Entrada documental móvil',
  description = 'Sube una factura o albarán (foto, imagen o PDF) para crear un borrador revisable en Compras.',
  runOcrAfterUpload = false,
  redirectToDetailOnSuccess = false,
  showDocumentLinkOnSuccess = true,
  className,
}: SharedProcurementDocumentIntakeProps) {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdDocumentId, setCreatedDocumentId] = useState<string | null>(null);
  const [documentKind, setDocumentKind] = useState<ProcurementDocumentKind>('delivery_note');

  async function createDraftFromFile(file: File | null) {
    if (!file) return;

    setError(null);
    setCreatedDocumentId(null);
    setIsSubmitting(true);

    try {
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
      const documentId = typeof createdPayload?.id === 'string' ? createdPayload.id : null;
      if (!createResponse.ok || !documentId) {
        throw new Error(createdPayload?.error ?? 'No se pudo crear el borrador');
      }

      const formData = new FormData();
      formData.set('file', file);
      const uploadResponse = await fetch(`/api/cheffing/procurement/documents/${documentId}/source-file`, {
        method: 'POST',
        body: formData,
      });
      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) {
        setCreatedDocumentId(documentId);
        throw new Error(uploadPayload?.error ?? 'No se pudo subir el archivo');
      }

      if (runOcrAfterUpload) {
        const ocrResponse = await fetch(`/api/cheffing/procurement/documents/${documentId}/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allow_override_lines: false }),
        });
        const ocrPayload = await ocrResponse.json().catch(() => ({}));
        if (!ocrResponse.ok) {
          setCreatedDocumentId(documentId);
          throw new Error(ocrPayload?.error ?? 'OCR no disponible para este documento');
        }
      }

      setCreatedDocumentId(documentId);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (redirectToDetailOnSuccess) {
        router.push(`/cheffing/compras/${documentId}`);
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

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
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => createDraftFromFile(event.target.files?.[0] ?? null)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => createDraftFromFile(event.target.files?.[0] ?? null)}
      />

      <p className="text-xs text-slate-500">Soportado en este bloque: 1 documento por subida (imagen o PDF).</p>

      {isSubmitting ? (
        <p className="text-sm text-sky-300">
          {runOcrAfterUpload ? 'Subiendo documento, creando borrador y lanzando OCR…' : 'Subiendo documento y creando borrador…'}
        </p>
      ) : null}

      {createdDocumentId ? (
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
          {error}
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
