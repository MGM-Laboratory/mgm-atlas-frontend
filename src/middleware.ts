import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/health', '/status', '/api/auth'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  if (req.auth.error === 'RefreshAccessTokenError') {
    const url = new URL('/login', req.url);
    url.searchParams.set('reason', 'session-expired');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/.*).*)'],
};
