import { del, list } from '@vercel/blob';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth.js';
import { serverErrorResponse } from './_lib/errors.js';

function requireAuth(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  return verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);
}

// `limit: 1000` sans pagination côté client : outil interne à usage restreint
// (une UD, une newsletter), le volume réel restera loin de ce plafond. À
// revisiter si l'usage grossit un jour (voir CLAUDE.md).
//
// Deux préfixes distincts : `articles/` reçoit les imports faits depuis cette
// galerie, `seed/` contient les images d'origine posées par scripts/seed.ts
// au lancement du projet (masthead, encarts, photos d'articles historiques).
// Sans les deux, la galerie resterait vide tant qu'aucun nouvel import n'a
// eu lieu, alors que ces images existent déjà et sont réutilisables.
export async function GET(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const [articles, seed] = await Promise.all([
      list({ prefix: 'articles/', limit: 1000 }),
      list({ prefix: 'seed/', limit: 1000 }),
    ]);
    const images = [...articles.blobs, ...seed.blobs]
      .map((b) => ({ url: b.url, uploadedAt: b.uploadedAt, size: b.size }))
      .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));

    return Response.json(images);
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}

// Suppression volontairement sans vérification d'usage dans la newsletter
// courante (outil interne à usage restreint) : si l'image supprimée est
// encore référencée quelque part, elle s'affichera cassée — à l'utilisateur
// de vérifier avant de confirmer (voir confirm() côté front).
export async function DELETE(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const url = new URL(request.url).searchParams.get('url');
    if (!url || !url.startsWith('https://')) {
      return Response.json({ error: 'Paramètre url manquant ou invalide' }, { status: 400 });
    }

    // `del()` valide elle-même que l'URL appartient au store Blob du projet
    // (elle lève sinon) : pas de vérification de domaine supplémentaire ici.
    await del(url);

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}
