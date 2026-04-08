import { NextRequest, NextResponse } from 'next/server';

import { getProcurementRetentionConfig, runProcurementDiscardedRetention, type ProcurementRetentionMode } from '@/lib/cheffing/procurementRetention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

type ParsedModeResult =
  | { ok: true; mode: ProcurementRetentionMode }
  | { ok: false; error: string };

function parseMode(req: NextRequest): ParsedModeResult {
  const fromQuery = req.nextUrl.searchParams.get('mode')?.trim().toLowerCase();

  if (!fromQuery) {
    return { ok: true, mode: 'dry-run' };
  }

  if (fromQuery === 'dry-run' || fromQuery === 'execute') {
    return { ok: true, mode: fromQuery };
  }

  return { ok: false, error: 'Invalid retention mode. Use dry-run or execute.' };
}

function requestSecret(req: NextRequest): string {
  const bearerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (bearerToken) return bearerToken;

  const headerToken = req.headers.get('x-procurement-retention-secret')?.trim();
  if (headerToken) return headerToken;

  return '';
}

function ensureAuthorized(req: NextRequest): NextResponse | null {
  let config;
  try {
    config = getProcurementRetentionConfig();
  } catch (error) {
    console.error('[cheffing][procurement][retention] Missing required env', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Retention route not configured' }, { status: 500 });
  }

  const incomingSecret = requestSecret(req);
  if (!incomingSecret || incomingSecret !== config.secret) {
    return unauthorizedResponse();
  }

  return null;
}

async function handleRun(req: NextRequest) {
  const unauthorized = ensureAuthorized(req);
  if (unauthorized) return unauthorized;

  const parsedMode = parseMode(req);
  if (!parsedMode.ok) {
    return NextResponse.json({ ok: false, error: parsedMode.error }, { status: 400 });
  }

  const mode = parsedMode.mode;

  let config;
  try {
    config = getProcurementRetentionConfig();
  } catch {
    return NextResponse.json({ error: 'Retention route not configured' }, { status: 500 });
  }

  if (mode === 'execute' && !config.enabled) {
    return NextResponse.json(
      {
        ok: false,
        mode,
        error: 'Execute mode disabled. Set PROCUREMENT_RETENTION_ENABLED=true to allow retention execution.',
      },
      { status: 403 },
    );
  }

  try {
    const result = await runProcurementDiscardedRetention(mode);

    console.info('[cheffing][procurement][retention] Execution completed', {
      mode: result.mode,
      candidateCount: result.candidateCount,
      processedCount: result.processedCount,
      purgedCount: result.purgedCount,
      errorCount: result.errorCount,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[cheffing][procurement][retention] Execution failed', {
      mode,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ ok: false, mode, error: 'Retention execution failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleRun(req);
}

export async function POST(req: NextRequest) {
  return handleRun(req);
}
