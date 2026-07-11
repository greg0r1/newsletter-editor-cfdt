import { supabase } from './_lib/supabase.js';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth.js';
import { sanitizeHtml } from './_lib/sanitize.js';
import { serverErrorResponse } from './_lib/errors.js';
import { articleRowToDTO, type ArticleRow, type ArticleVersionRow } from './_lib/types.js';
import { isRestoreArticleVersionBody } from './_lib/validate.js';

function requireAuth(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  return verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);
}

export async function GET(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const url = new URL(request.url);
    const articleId = url.searchParams.get('articleId');
    if (!articleId) return Response.json({ error: 'Paramètre articleId manquant' }, { status: 400 });

    const { data, error } = await supabase
      .from('article_versions')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false })
      .returns<ArticleVersionRow[]>();

    if (error) throw new Error(`Chargement de l'historique impossible: ${error.message}`);

    const versions = (data ?? []).map((row) => ({
      id: row.id,
      articleId: row.article_id,
      snapshot: row.snapshot,
      createdAt: row.created_at,
    }));

    return Response.json(versions);
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const rawBody: unknown = await request.json();
    if (!isRestoreArticleVersionBody(rawBody)) {
      return Response.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const body = rawBody;

    const { data: versionRow, error: versionError } = await supabase
      .from('article_versions')
      .select('*')
      .eq('id', body.versionId)
      .eq('article_id', body.articleId)
      .single<ArticleVersionRow>();

    if (versionError || !versionRow) {
      throw new Error(`Version introuvable: ${versionError?.message ?? ''}`);
    }

    // Sanitize à nouveau au cas où le snapshot proviendrait d'une version
    // écrite avant l'introduction du sanitizer serveur (défense en profondeur).
    const snapshot = versionRow.snapshot;
    const { data: restoredRow, error: restoreError } = await supabase
      .from('articles')
      .update({
        title: sanitizeHtml(snapshot.title),
        image_url: snapshot.imageUrl,
        body: sanitizeHtml(snapshot.body),
        highlight: snapshot.highlight != null ? sanitizeHtml(snapshot.highlight) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.articleId)
      .select('*')
      .single<ArticleRow>();

    if (restoreError || !restoredRow) {
      throw new Error(`Restauration impossible: ${restoreError?.message ?? ''}`);
    }

    const dto = articleRowToDTO(restoredRow);

    const { error: newVersionError } = await supabase.from('article_versions').insert({
      article_id: dto.id,
      snapshot: dto,
    });
    if (newVersionError) {
      throw new Error(`Écriture de l'historique impossible: ${newVersionError.message}`);
    }

    return Response.json(dto);
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}
