import { next } from '@vercel/functions';
import { AUTH_COOKIE_NAME, parseCookies, verifySessionCookieValue } from './api/_lib/auth';

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!login|api/login|assets|favicon.ico).*)'],
};

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  const authenticated = verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);

  if (authenticated) return next();

  if (url.pathname.startsWith('/api/')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redirectUrl = new URL('/login/', url.origin);
  if (url.pathname !== '/' && url.pathname !== '/login/') {
    redirectUrl.searchParams.set('redirect', url.pathname);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
}
