import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

const DEFAULT_DISCARDED_DAYS = 45;
const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 200;

type RetentionTimestampSource = 'discarded_at' | 'updated_at';

type ProcurementRetentionCandidate = {
  id: string;
  storage_bucket: string | null;
  storage_path: string | null;
  discarded_at: string | null;
  updated_at: string;
};

export type ProcurementRetentionMode = 'dry-run' | 'execute';

export type ProcurementRetentionError = {
  documentId: string;
  stage: 'storage_remove' | 'reference_cleanup';
  message: string;
};

export type ProcurementRetentionResult = {
  mode: ProcurementRetentionMode;
  cutoffIso: string;
  discardedDays: number;
  batchLimit: number;
  enabled: boolean;
  candidateCount: number;
  processedCount: number;
  purgedCount: number;
  omittedCount: number;
  errorCount: number;
  affectedDocumentIds: string[];
  errors: ProcurementRetentionError[];
  candidates: Array<{
    id: string;
    storageBucket: string;
    storagePath: string;
    retentionTimestamp: string;
    retentionTimestampSource: RetentionTimestampSource;
  }>;
};

export type ProcurementRetentionConfig = {
  enabled: boolean;
  secret: string;
  discardedDays: number;
  batchLimit: number;
};

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function getProcurementRetentionConfig(): ProcurementRetentionConfig {
  const secret = process.env.PROCUREMENT_RETENTION_SECRET?.trim() ?? '';
  if (!secret) {
    throw new Error('Missing PROCUREMENT_RETENTION_SECRET');
  }

  const discardedDays = parsePositiveInteger(process.env.PROCUREMENT_RETENTION_DISCARDED_DAYS, DEFAULT_DISCARDED_DAYS);
  const requestedBatchLimit = parsePositiveInteger(process.env.PROCUREMENT_RETENTION_BATCH_LIMIT, DEFAULT_BATCH_LIMIT);

  return {
    enabled: parseBoolean(process.env.PROCUREMENT_RETENTION_ENABLED, false),
    secret,
    discardedDays,
    batchLimit: Math.min(requestedBatchLimit, MAX_BATCH_LIMIT),
  };
}

function resolveCutoff(now: Date, discardedDays: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - discardedDays);
  return cutoff;
}

function isStorageMissingErrorMessage(message: string | undefined): boolean {
  const normalized = (message ?? '').toLowerCase();
  return normalized.includes('not found') || normalized.includes('no such file') || normalized.includes('already deleted');
}

async function fetchCandidates(cutoffIso: string, batchLimit: number) {
  const supabase = createSupabaseAdminClient();

  const { data: withDiscardedAt, error: withDiscardedAtError } = await supabase
    .from('cheffing_purchase_documents')
    .select('id, storage_bucket, storage_path, discarded_at, updated_at')
    .eq('status', 'discarded')
    .not('storage_bucket', 'is', null)
    .not('storage_path', 'is', null)
    .not('discarded_at', 'is', null)
    .lte('discarded_at', cutoffIso)
    .order('discarded_at', { ascending: true })
    .limit(batchLimit);

  if (withDiscardedAtError) {
    throw new Error(`Failed to fetch discarded_at candidates: ${withDiscardedAtError.message}`);
  }

  const remaining = Math.max(batchLimit - (withDiscardedAt?.length ?? 0), 0);
  let withUpdatedAtFallback: ProcurementRetentionCandidate[] = [];

  if (remaining > 0) {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from('cheffing_purchase_documents')
      .select('id, storage_bucket, storage_path, discarded_at, updated_at')
      .eq('status', 'discarded')
      .not('storage_bucket', 'is', null)
      .not('storage_path', 'is', null)
      .is('discarded_at', null)
      .lte('updated_at', cutoffIso)
      .order('updated_at', { ascending: true })
      .limit(remaining);

    if (fallbackError) {
      throw new Error(`Failed to fetch updated_at fallback candidates: ${fallbackError.message}`);
    }

    withUpdatedAtFallback = fallbackRows ?? [];
  }

  const rows = [...(withDiscardedAt ?? []), ...withUpdatedAtFallback];

  return rows
    .filter((row): row is ProcurementRetentionCandidate & { storage_bucket: string; storage_path: string } => {
      return Boolean(row.storage_bucket && row.storage_path);
    })
    .map((row) => ({
      id: row.id,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
      retentionTimestamp: row.discarded_at ?? row.updated_at,
      retentionTimestampSource: (row.discarded_at ? 'discarded_at' : 'updated_at') as RetentionTimestampSource,
    }));
}

export async function runProcurementDiscardedRetention(mode: ProcurementRetentionMode): Promise<ProcurementRetentionResult> {
  const config = getProcurementRetentionConfig();
  const now = new Date();
  const cutoff = resolveCutoff(now, config.discardedDays);
  const cutoffIso = cutoff.toISOString();

  const candidates = await fetchCandidates(cutoffIso, config.batchLimit);

  const result: ProcurementRetentionResult = {
    mode,
    cutoffIso,
    discardedDays: config.discardedDays,
    batchLimit: config.batchLimit,
    enabled: config.enabled,
    candidateCount: candidates.length,
    processedCount: 0,
    purgedCount: 0,
    omittedCount: 0,
    errorCount: 0,
    affectedDocumentIds: [],
    errors: [],
    candidates,
  };

  if (mode === 'dry-run') {
    return result;
  }

  const supabase = createSupabaseAdminClient();

  for (const candidate of candidates) {
    result.processedCount += 1;

    const { error: storageError } = await supabase.storage.from(candidate.storageBucket).remove([candidate.storagePath]);

    if (storageError && !isStorageMissingErrorMessage(storageError.message)) {
      result.errorCount += 1;
      result.errors.push({
        documentId: candidate.id,
        stage: 'storage_remove',
        message: storageError.message,
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from('cheffing_purchase_documents')
      .update({
        storage_bucket: null,
        storage_path: null,
      })
      .eq('id', candidate.id)
      .eq('status', 'discarded');

    if (updateError) {
      result.errorCount += 1;
      result.errors.push({
        documentId: candidate.id,
        stage: 'reference_cleanup',
        message: updateError.message,
      });
      continue;
    }

    result.purgedCount += 1;
    result.affectedDocumentIds.push(candidate.id);
  }

  result.omittedCount = result.candidateCount - result.purgedCount - result.errorCount;

  return result;
}
