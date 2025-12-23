import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from './src/lib/supabase/middleware';
import { createSupabaseAdminClient } from './src/lib/supabaseAdmin';
import { getSupabaseUrl } from './src/lib/supabase/env';

const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/auth\/callback/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');

  if (PUBLIC_PATHS.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  const supabaseResponse = NextResponse.next({ request: { headers: req.headers } });
  const supabase = createSupabaseMiddlewareClient(req, supabaseResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectUrl = new URL('/login', req.url);
  if (!isApiRoute && pathname !== '/') {
    redirectUrl.searchParams.set('next', `${pathname}${search}`);
  }

  const handleUnauthorized = () => {
    if (isApiRoute) {
      const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      mergeCookies(supabaseResponse, unauthorized);
      return unauthorized;
    }

    const response = NextResponse.redirect(redirectUrl);
    mergeCookies(supabaseResponse, response);

    return response;
  };

  const handleNotAllowed = () => {
    if (isApiRoute) {
      const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      mergeCookies(supabaseResponse, notAllowed);
      clearAuthCookies(req, notAllowed);
      return notAllowed;
    }

    const url = new URL(redirectUrl);
    url.searchParams.set('error', 'not_allowed');
    const response = NextResponse.redirect(url);
    mergeCookies(supabaseResponse, response);
    clearAuthCookies(req, response);

    return response;
  };

  const handleConfigError = () =>
    handleConfigErrorResponse(isApiRoute, supabaseResponse, redirectUrl, req);

  if (!user) {
    return handleUnauthorized();
  }

  const email = user.email?.toLowerCase();

  if (!email) {
    return handleNotAllowed();
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();

    const {
      data: allowedUser,
      error: allowlistError,
    } = await supabaseAdmin
      .from('app_allowed_users')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (allowlistError) {
      console.error('[middleware] allowlist query error', allowlistError);
      return handleConfigError();
    }

    if (!allowedUser) {
      return handleNotAllowed();
    }
  } catch (error) {
    console.error('[middleware] allowlist check failed', error);
    return handleConfigError();
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

function handleConfigErrorResponse(
  isApiRoute: boolean,
  supabaseResponse: NextResponse,
  redirectUrl: URL,
  req: NextRequest,
) {
  if (isApiRoute) {
    const misconfigured = NextResponse.json({ error: 'config' }, { status: 500 });
    mergeCookies(supabaseResponse, misconfigured);
    clearAuthCookies(req, misconfigured);
    return misconfigured;
  }

  const url = new URL(redirectUrl);
  url.searchParams.set('error', 'config');
  const response = NextResponse.redirect(url);
  mergeCookies(supabaseResponse, response);
  clearAuthCookies(req, response);

  return response;
}
