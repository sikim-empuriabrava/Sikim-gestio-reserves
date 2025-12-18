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

  const supabaseUrl = getSupabaseUrl();

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
      clearAuthCookies(req, notAllowed, supabaseUrl);
      return notAllowed;
    }

    const url = new URL(redirectUrl);
    url.searchParams.set('error', 'not_allowed');
    const response = NextResponse.redirect(url);
    mergeCookies(supabaseResponse, response);
    clearAuthCookies(req, response, supabaseUrl);

    return response;
  };

  if (!user) {
    return handleUnauthorized();
  }

  const email = user.email;

  if (!email) {
    return handleNotAllowed();
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: allowedUser, error } = await supabaseAdmin
      .from('app_allowed_users')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !allowedUser) {
      return handleNotAllowed();
    }
  } catch (error) {
    console.error('[middleware] allowlist check failed', error);

    if (isApiRoute) {
      const misconfigured = NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
      mergeCookies(supabaseResponse, misconfigured);
      return misconfigured;
    }

    const url = new URL(redirectUrl);
    url.searchParams.set('error', 'config');
    const response = NextResponse.redirect(url);
    mergeCookies(supabaseResponse, response);

    return response;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

function getAuthCookiePrefix(supabaseUrl: string) {
  const url = new URL(supabaseUrl);
  const projectRef = url.host.split('.')[0];
  return `sb-${projectRef}-auth-token-`;
}

function clearAuthCookies(req: NextRequest, res: NextResponse, supabaseUrl: string) {
  const prefix = getAuthCookiePrefix(supabaseUrl);
  const cookiesToClear = [
    ...req.cookies.getAll().map(({ name }) => name),
    ...res.cookies.getAll().map(({ name }) => name),
  ];

  cookiesToClear.forEach((name) => {
    if (name.startsWith(prefix)) {
      res.cookies.set({ name, value: '', path: '/', expires: new Date(0) });
    }
  });
}

function mergeCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}
