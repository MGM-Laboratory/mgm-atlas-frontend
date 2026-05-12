import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/health', '/status', '/api/auth'];

/**
 * Middleware to protect routes. Since we're using localStorage for sessions,
 * we can't validate them server-side here. Instead, we:
 * 1. Allow all requests through
 * 2. Let the frontend check localStorage and redirect to login if needed
 * 3. API calls include sessionId in Authorization header, validated by backend
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  const isPublic = PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isPublic) {
    return NextResponse.next();
  }

  // For protected routes, we can't check session server-side with localStorage.
  // The frontend components will handle redirection to /login.
  // All API calls will be rejected by the backend if sessionId is invalid.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/.*).*)'],
};
