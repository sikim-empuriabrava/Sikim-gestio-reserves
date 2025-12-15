import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from './src/lib/supabase/middleware';

const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/auth\/callback/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PATHS.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: { headers: req.headers } });
  const supabase = createSupabaseMiddlewareClient(req, res);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const redirectUrl = new URL('/login', req.url);
    if (pathname !== '/') {
      redirectUrl.searchParams.set('next', `${pathname}${search}`);
    }

    return NextResponse.redirect(redirectUrl);
  }

  const email = session.user.email;
  const redirectNotAllowed = () => {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('error', 'not_allowed');
    if (pathname !== '/') {
      redirectUrl.searchParams.set('next', `${pathname}${search}`);
    }

    const response = NextResponse.redirect(redirectUrl);

    req.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) {
        response.cookies.set({ name, value: '', maxAge: 0, path: '/' });
      }
    });

    return response;
  };

  if (!email) {
    return redirectNotAllowed();
  }

  const { data: allowedUser, error } = await supabase
    .from('app_allowed_users')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !allowedUser) {
    return redirectNotAllowed();
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
