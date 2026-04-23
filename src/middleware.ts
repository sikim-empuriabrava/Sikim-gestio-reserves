import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from './lib/supabase/middleware';
import { getMissingSupabaseEnv, getSupabaseUrl } from './lib/supabase/env';

const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/auth\/callback/,
  /^\/_next\//,
  /^\/branding\//,
  /^\/api\/version$/,
  /^\/api\/_health\/env$/,
  /^\/favicon\.ico$/,
];
const AFORO_PWA_COOKIE = 'sikim_aforo_pwa';
const AFORO_PWA_ALLOWED_PATHS = [/^\/login$/, /^\/auth\/callback/, /^\/disco\/aforo-en-directo\/?$/];
const AFORO_PWA_ALLOWED_API_PATHS = [/^\/api\/disco\/live-capacity$/, /^\/api\/version$/];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');
  const isAforoPwaRequest = req.cookies.get(AFORO_PWA_COOKIE)?.value === '1';
  const secFetchDest = req.headers.get('sec-fetch-dest');
  const isDocumentNavigation = secFetchDest === 'document';
  const isAforoPwaContextPath =
    AFORO_PWA_ALLOWED_PATHS.some((pattern) => pattern.test(pathname)) ||
    AFORO_PWA_ALLOWED_API_PATHS.some((pattern) => pattern.test(pathname));
  const shouldClearAforoPwaCookie =
    isAforoPwaRequest && !isAforoPwaContextPath && isDocumentNavigation;

  if (PUBLIC_PATHS.some((pattern) => pattern.test(pathname))) {
    const response = setDebugHeader(NextResponse.next());
    if (shouldClearAforoPwaCookie) {
      clearAforoPwaCookie(response);
    }
    return response;
  }

  const redirectUrl = new URL('/login', req.url);
  if (!isApiRoute && pathname !== '/') {
    redirectUrl.searchParams.set('next', `${pathname}${search}`);
  }

  const supabaseResponse = setDebugHeader(NextResponse.next({ request: { headers: req.headers } }));
  const missingSupabaseEnv = getMissingSupabaseEnv();

  if (missingSupabaseEnv.length > 0) {
    return handleConfigErrorResponse(
      isApiRoute,
      supabaseResponse,
      redirectUrl,
      req,
      missingSupabaseEnv,
    );
  }

  const supabase = createSupabaseMiddlewareClient(req, supabaseResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const handleUnauthorized = () => {
    if (isApiRoute) {
      const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      mergeCookies(supabaseResponse, unauthorized);
      if (shouldClearAforoPwaCookie) {
        clearAforoPwaCookie(unauthorized);
      }
      return setDebugHeader(unauthorized);
    }

    const response = NextResponse.redirect(redirectUrl);
    mergeCookies(supabaseResponse, response);
    if (shouldClearAforoPwaCookie) {
      clearAforoPwaCookie(response);
    }

    return setDebugHeader(response);
  };

  const handleNotAllowed = () => {
    if (isApiRoute) {
      const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      mergeCookies(supabaseResponse, notAllowed);
      clearAuthCookies(req, notAllowed);
      return setDebugHeader(notAllowed);
    }

    const url = new URL(redirectUrl);
    url.searchParams.set('error', 'not_allowed');
    const response = NextResponse.redirect(url);
    mergeCookies(supabaseResponse, response);
    clearAuthCookies(req, response);

    return setDebugHeader(response);
  };

  const handlePwaForbidden = () => {
    if (isApiRoute) {
      const forbidden = NextResponse.json({ error: 'forbidden_pwa_scope' }, { status: 403 });
      mergeCookies(supabaseResponse, forbidden);
      return setDebugHeader(forbidden);
    }

    const response = NextResponse.redirect(new URL('/disco/aforo-en-directo', req.url));
    mergeCookies(supabaseResponse, response);
    return setDebugHeader(response);
  };

  const handleConfigError = () =>
    handleConfigErrorResponse(isApiRoute, supabaseResponse, redirectUrl, req);

  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isReservasPath =
    pathname.startsWith('/reservas') ||
    pathname.startsWith('/api/rooms') ||
    pathname.startsWith('/api/group-events') ||
    pathname.startsWith('/api/day-status') ||
    pathname.startsWith('/api/menus');
  const isMantenimientoPath = pathname.startsWith('/mantenimiento');
  const isCocinaPath = pathname.startsWith('/cocina');
  const isDiscoPath = pathname.startsWith('/disco') || pathname.startsWith('/api/disco');
  const isAforoLiveCapacityPage = !isApiRoute && /^\/disco\/aforo-en-directo\/?$/.test(pathname);

  if (!user) {
    if (isAforoLiveCapacityPage) {
      if (shouldClearAforoPwaCookie) {
        clearAforoPwaCookie(supabaseResponse);
      }
      return supabaseResponse;
    }

    return handleUnauthorized();
  }

  const isAllowedAforoPwaPath = isApiRoute
    ? AFORO_PWA_ALLOWED_API_PATHS.some((pattern) => pattern.test(pathname))
    : AFORO_PWA_ALLOWED_PATHS.some((pattern) => pattern.test(pathname));

  if (isAforoPwaRequest && !isAllowedAforoPwaPath) {
    return handlePwaForbidden();
  }

  const requesterEmail =
    user.email?.trim().toLowerCase() ??
    (user.user_metadata?.email as string | undefined)?.trim().toLowerCase();

  if (!requesterEmail) {
    return handleNotAllowed();
  }

  // Filter by email and active status to avoid mismatches or multi-row errors.
  const { data: allowedUser, error: allowlistError } = await supabase
    .from('app_allowed_users')
    .select(
      'email, role, is_active, can_reservas, can_mantenimiento, can_cocina, can_cheffing, view_live_capacity, manage_live_capacity, cheffing_images_manage',
    )
    .eq('email', requesterEmail)
    .eq('is_active', true)
    .maybeSingle();

  if (allowlistError) {
    console.error('[middleware] allowlist query error', allowlistError);
    return handleConfigError();
  }

  if (!allowedUser) {
    return handleNotAllowed();
  }

  const isAdminUser = allowedUser.role === 'admin';

  const handleForbidden = () => {
    if (isApiRoute) {
      const forbidden = NextResponse.json({ error: 'forbidden' }, { status: 403 });
      mergeCookies(supabaseResponse, forbidden);
      return setDebugHeader(forbidden);
    }

    const redirectTarget = getDefaultModulePath(allowedUser);
    const response = NextResponse.redirect(new URL(redirectTarget, req.url));
    mergeCookies(supabaseResponse, response);
    return setDebugHeader(response);
  };

  if (isAdminPath && !isAdminUser) {
    return handleForbidden();
  }

  if (isReservasPath && !isAdminUser && !allowedUser.can_reservas) {
    return handleForbidden();
  }

  if (isMantenimientoPath && !isAdminUser && !allowedUser.can_mantenimiento) {
    return handleForbidden();
  }

  if (isCocinaPath && !isAdminUser && !allowedUser.can_cocina) {
    return handleForbidden();
  }

  const canViewLiveCapacity = Boolean(allowedUser.view_live_capacity || allowedUser.manage_live_capacity);
  if (isDiscoPath && !isAdminUser && !canViewLiveCapacity) {
    return handleForbidden();
  }

  if (shouldClearAforoPwaCookie) {
    clearAforoPwaCookie(supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

function clearAuthCookies(req: NextRequest, res: NextResponse) {
  try {
    const storageKey = getAuthStorageKey();
    const names = new Set(
      [...req.cookies.getAll(), ...res.cookies.getAll()].map((cookie) => cookie.name).filter(Boolean),
    );
    const storageKeyValid = storageKey && storageKey !== 'sb-';

    const shouldClear = (name: string) => {
      if (storageKeyValid) {
        return name === storageKey || name.startsWith(`${storageKey}-`);
      }

      return name.startsWith('sb-') && name.includes('-auth-token');
    };

    names.forEach((name) => {
      if (!shouldClear(name)) return;

      res.cookies.set({
        name,
        value: '',
        path: '/',
        expires: new Date(0),
        maxAge: 0,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    });
  } catch (error) {
    console.error('[middleware] clearAuthCookies failed', error);
  }
}

function getAuthStorageKey() {
  try {
    const projectRef = new URL(getSupabaseUrl()).host.split('.')[0];
    return `sb-${projectRef}-auth-token`;
  } catch (error) {
    console.error('[middleware] getAuthStorageKey failed', error);
    return 'sb-';
  }
}

function mergeCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

function clearAforoPwaCookie(res: NextResponse) {
  res.cookies.set({
    name: AFORO_PWA_COOKIE,
    value: '',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

function getDefaultModulePath(allowedUser: {
  can_reservas?: boolean | null;
  can_mantenimiento?: boolean | null;
  can_cocina?: boolean | null;
  can_cheffing?: boolean | null;
  view_live_capacity?: boolean | null;
  manage_live_capacity?: boolean | null;
}) {
  if (allowedUser?.can_reservas) return '/reservas';
  if (allowedUser?.view_live_capacity || allowedUser?.manage_live_capacity) return '/disco/aforo-en-directo';
  if (allowedUser?.can_mantenimiento) return '/mantenimiento';
  if (allowedUser?.can_cocina) return '/cocina';
  if (allowedUser?.can_cheffing) return '/cheffing';
  return '/';
}

function setDebugHeader(response: NextResponse) {
  response.headers.set('x-sikim-mw', '1');
  return response;
}

function handleConfigErrorResponse(
  isApiRoute: boolean,
  supabaseResponse: NextResponse,
  redirectUrl: URL,
  req: NextRequest,
  missingEnv: string[] = [],
) {
  if (isApiRoute) {
    const misconfigured = NextResponse.json({ error: 'config', missing: missingEnv }, { status: 500 });
    mergeCookies(supabaseResponse, misconfigured);
    clearAuthCookies(req, misconfigured);
    return setDebugHeader(misconfigured);
  }

  const url = new URL(redirectUrl);
  url.searchParams.set('error', 'config');
  if (missingEnv.length > 0) {
    url.searchParams.set('missing', missingEnv.join(','));
  }
  const response = NextResponse.redirect(url);
  mergeCookies(supabaseResponse, response);
  clearAuthCookies(req, response);

  return setDebugHeader(response);
}
