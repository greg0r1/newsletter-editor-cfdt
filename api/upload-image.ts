import { put } from '@vercel/blob';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth';

function requireAuth(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  return verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);
}

export async function POST(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Fichier manquant' }, { status: 400 });
    }

    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `articles/${crypto.randomUUID()}.${extension}`;

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    return Response.json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
