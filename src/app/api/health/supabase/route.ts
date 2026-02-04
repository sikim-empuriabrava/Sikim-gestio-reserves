import { NextResponse } from 'next/server';

import { getSupabaseEnvStatus } from '@/lib/supabase/env';

const HEALTH_ENDPOINT = '/auth/v1/health';

export async function GET() {
  const { url, anonKey, missing } = getSupabaseEnvStatus();
  const hasUrl = Boolean(url);
  const hasAnonKey = Boolean(anonKey);

  let pingStatus: number | undefined;
  let error: string | undefined;

  if (hasUrl) {
    try {
      const healthUrl = new URL(HEALTH_ENDPOINT, url);
      const response = await fetch(healthUrl.toString(), {
        method: 'GET',
        headers: hasAnonKey ? { apikey: anonKey } : undefined,
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
    urlHost: hasUrl ? new URL(url).host : null,
    anonKeyLength: hasAnonKey ? anonKey.length : null,
  });
}
