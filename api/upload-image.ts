import { put } from '@vercel/blob';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth.js';
import { serverErrorResponse } from './_lib/errors.js';

function requireAuth(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  return verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);
}

// Le front (src/edit/image.ts) compresse toujours en JPEG avant upload ; on
// reste néanmoins un peu plus large pour ne pas casser un import manuel via
// l'API. Exclut explicitement SVG (peut embarquer du <script>/JS inline) et
// tout type non-image.
const ALLOWED_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo, large marge au-dessus des ~560px JPEG compressés côté client

export async function POST(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Fichier manquant' }, { status: 400 });
    }

    // L'extension est dérivée du type MIME réel du fichier, jamais du nom
    // fourni par le client (évite qu'un `.svg`/`.html` renommé en `.jpg` soit
    // servi tel quel — un SVG public sur Vercel Blob peut embarquer du JS).
    const extension = ALLOWED_MIME_TO_EXTENSION[file.type];
    if (!extension) {
      return Response.json({ error: 'Type de fichier non autorisé (image JPEG/PNG/WebP/GIF uniquement).' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json({ error: 'Fichier trop volumineux (8 Mo maximum).' }, { status: 400 });
    }

    const filename = `articles/${crypto.randomUUID()}.${extension}`;

    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    });

    return Response.json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}
