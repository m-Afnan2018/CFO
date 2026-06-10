import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let the login page through always
  if (pathname.startsWith('/login')) return NextResponse.next();

  const token = req.cookies.get('cfo_auth')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on all page routes; skip Next.js internals, static assets, and API proxy
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
