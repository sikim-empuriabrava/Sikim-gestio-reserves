import { NextRequest, NextResponse } from 'next/server';

import {
  adjustLiveCapacity,
  closeLiveCapacitySession,
  getLiveCapacityState,
  openLiveCapacitySession,
} from '@/lib/disco/liveCapacity';
import { requireLiveCapacityRouteAccess } from '@/lib/disco/requireLiveCapacityRoute';
import { mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';

export async function GET() {
  const access = await requireLiveCapacityRouteAccess();
  if (access.response) return access.response;

  const state = await getLiveCapacityState();
  const response = NextResponse.json({
    ok: true,
    state,
    permissions: {
      canManage: Boolean(access.canManage),
    },
  });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action : '';

  const requiresManage = action === 'open_session' || action === 'close_session' || action === 'adjust';
  const access = await requireLiveCapacityRouteAccess({ requireManage: requiresManage });

  if (access.response) return access.response;
  if (!access.requesterEmail) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(access.supabaseResponse, forbidden);
    return forbidden;
  }

  try {
    if (action === 'open_session') {
      await openLiveCapacitySession(access.requesterEmail);
    } else if (action === 'close_session') {
      await closeLiveCapacitySession(access.requesterEmail);
    } else if (action === 'adjust') {
      const delta = Number(body?.delta);
      if (!Number.isInteger(delta) || delta === 0) {
        const invalidDelta = NextResponse.json({ error: 'Invalid delta' }, { status: 400 });
        mergeResponseCookies(access.supabaseResponse, invalidDelta);
        return invalidDelta;
      }

      await adjustLiveCapacity({
        actorEmail: access.requesterEmail,
        delta,
      });
    } else {
      const invalidAction = NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalidAction);
      return invalidAction;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const badRequestErrors = ['already an open session', 'no open session', 'below zero'];
    const status = badRequestErrors.some((text) => message.includes(text)) ? 400 : 500;
    const failure = NextResponse.json({ error: message }, { status });
    mergeResponseCookies(access.supabaseResponse, failure);
    return failure;
  }

  const state = await getLiveCapacityState();
  const response = NextResponse.json({
    ok: true,
    state,
    permissions: {
      canManage: Boolean(access.canManage),
    },
  });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
