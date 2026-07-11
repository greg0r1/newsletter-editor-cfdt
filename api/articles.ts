import { supabase } from './_lib/supabase.js';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth.js';
import { sanitizeHtml } from './_lib/sanitize.js';
import { serverErrorResponse } from './_lib/errors.js';
import { articleRowToDTO, type ArticleDTO, type ArticleRow } from './_lib/types.js';
import { isCreateArticleBody, isReorderArticlesBody, isUpdateArticleBody } from './_lib/validate.js';

function requireAuth(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  return verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);
}

async function insertVersion(article: ArticleDTO): Promise<void> {
  const { error } = await supabase.from('article_versions').insert({
    article_id: article.id,
    snapshot: article,
  });
  if (error) throw new Error(`Écriture de l'historique impossible: ${error.message}`);
}

export async function POST(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const rawBody: unknown = await request.json();
    if (!isCreateArticleBody(rawBody)) {
      return Response.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const body = rawBody;

    const { data, error } = await supabase
      .from('articles')
      .insert({
        newsletter_id: body.newsletterId,
        position: body.position,
        title: sanitizeHtml(body.title),
        image_url: body.imageUrl,
        body: sanitizeHtml(body.body),
        highlight: body.highlight != null ? sanitizeHtml(body.highlight) : null,
      })
      .select('*')
      .single<ArticleRow>();

    if (error || !data) throw new Error(`Création de l'article impossible: ${error?.message}`);

    const dto = articleRowToDTO(data);
    await insertVersion(dto);
    return Response.json(dto, { status: 201 });
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const rawBody: unknown = await request.json();
    if (!isUpdateArticleBody(rawBody)) {
      return Response.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const body = rawBody;

    const { data, error } = await supabase
      .from('articles')
      .update({
        position: body.position,
        title: sanitizeHtml(body.title),
        image_url: body.imageUrl,
        body: sanitizeHtml(body.body),
        highlight: body.highlight != null ? sanitizeHtml(body.highlight) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select('*')
      .single<ArticleRow>();

    if (error || !data) throw new Error(`Mise à jour de l'article impossible: ${error?.message}`);

    const dto = articleRowToDTO(data);
    await insertVersion(dto);
    return Response.json(dto);
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}

export async function PATCH(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const rawBody: unknown = await request.json();
    if (!isReorderArticlesBody(rawBody)) {
      return Response.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const body = rawBody;

    await Promise.all(
      body.orderedIds.map((id, index) =>
        supabase
          .from('articles')
          .update({ position: index })
          .eq('id', id)
          .eq('newsletter_id', body.newsletterId),
      ),
    );

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Paramètre id manquant' }, { status: 400 });

    const { error } = await supabase.from('articles').delete().eq('id', id);
    if (error) throw new Error(`Suppression impossible: ${error.message}`);

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}
