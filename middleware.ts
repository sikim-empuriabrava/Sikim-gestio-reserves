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

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
