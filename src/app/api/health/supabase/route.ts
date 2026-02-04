import { NextResponse } from 'next/server';

import { getSupabaseEnvStatus } from '@/lib/supabase/env';

const HEALTH_ENDPOINT = '/auth/v1/health';

export const runtime = 'nodejs';

export async function GET() {
  const status = getSupabaseEnvStatus();
  const url = status.url ?? undefined;
  const anonKey = status.anonKey ?? undefined;
  const missing = status.missing;
  const hasUrl = Boolean(url);
  const hasAnonKey = Boolean(anonKey);

  let pingStatus: number | undefined;
  let error: string | undefined;

  if (url) {
    try {
      const headers: HeadersInit | undefined = anonKey ? { apikey: anonKey } : undefined;
      const healthUrl = new URL(HEALTH_ENDPOINT, url);
      const response = await fetch(healthUrl.toString(), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      pingStatus = response.status;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  const pingOk = pingStatus === 200 || pingStatus === 204;
  const ok = hasUrl && hasAnonKey && (pingStatus ? pingOk : Boolean(error) === false);

  return NextResponse.json({
    ok,
    hasUrl,
    hasAnonKey,
    missing,
    pingStatus,
    error,
    urlHost: url ? new URL(url).host : null,
    anonKeyLength: anonKey ? anonKey.length : null,
  });
}
