import { next } from '@vercel/functions';
import { AUTH_COOKIE_NAME, parseCookies, verifySessionCookieValue } from './api/_lib/auth.js';

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!login|api/login).*)'],
};

// Ne protège que /api/* (données sensibles) et les navigations de document HTML.
// Les sous-ressources (JS/CSS, modules internes du dev server Vite : @vite, @fs, @id,
// node_modules, .vite/deps…) ne sont jamais bloquées : elles ne contiennent rien de
// sensible et whitelister leurs chemins un par un est un jeu sans fin.
function isDocumentNavigation(request: Request): boolean {
  if (request.headers.get('sec-fetch-mode') === 'navigate') return true;
  const accept = request.headers.get('accept') ?? '';
  return accept.includes('text/html');
}

export default function middleware(request: Request): Response {
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/api/') && !isDocumentNavigation(request)) {
    return next();
  }

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
