import { supabase } from './_lib/supabase.js';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth.js';
import { sanitizeHtml } from './_lib/sanitize.js';
import { serverErrorResponse } from './_lib/errors.js';
import { newsletterRowToDTO, type ArticleDTO, type ArticleRow, type NewsletterDTO, type NewsletterRow } from './_lib/types.js';
import { isNewsletterBody } from './_lib/validate.js';

function requireAuth(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  return verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);
}

async function loadNewsletter(): Promise<NewsletterDTO> {
  // Jointure imbriquée Supabase (PostgREST) : un seul aller-retour réseau au lieu
  // de deux requêtes séquentielles, ce qui compte doublement vu la latence entre
  // la fonction Vercel (iad1) et Supabase (eu-central-1).
  const { data: newsletterRow, error: newsletterError } = await supabase
    .from('newsletters')
    .select('*, articles(*)')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single<NewsletterRow & { articles: ArticleRow[] }>();

  if (newsletterError || !newsletterRow) {
    throw new Error(`Newsletter introuvable: ${newsletterError?.message ?? 'aucune ligne'}`);
  }

  const articleRows = [...newsletterRow.articles].sort((a, b) => a.position - b.position);

  return newsletterRowToDTO(newsletterRow, articleRows);
}

async function insertVersion(article: ArticleDTO): Promise<void> {
  const { error } = await supabase.from('article_versions').insert({
    article_id: article.id,
    snapshot: article,
  });
  if (error) throw new Error(`Écriture de l'historique impossible: ${error.message}`);
}

/**
 * Un article dont l'id n'est pas un UUID (ex. `tmp-1720000000000`, généré côté
 * front par `Editor.addArticle()` avant toute sauvegarde) n'existe pas encore
 * en base : il faut l'insérer plutôt que tenter un UPDATE qui ne matcherait
 * aucune ligne (échec silencieux — c'était le bug initial).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isPersistedId(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * Sanitize les seuls champs qui contiennent du HTML autorisé (issu du panneau
 * riche). Les autres champs des blocs (titre du bandeau, période, signatures…)
 * sont de simples chaînes texte lues en `textContent` côté front, jamais en
 * `innerHTML` — pas besoin de les sanitizer ici.
 */
function sanitizeNewsletterHtmlFields(body: NewsletterDTO): NewsletterDTO {
  return {
    ...body,
    edito: { ...body.edito, body: sanitizeHtml(body.edito.body) },
    infoBox: { ...body.infoBox, body: sanitizeHtml(body.infoBox.body) },
    summerBox: { ...body.summerBox, body: sanitizeHtml(body.summerBox.body) },
    articles: body.articles.map((a) => ({
      ...a,
      title: sanitizeHtml(a.title),
      body: sanitizeHtml(a.body),
      highlight: a.highlight != null ? sanitizeHtml(a.highlight) : null,
    })),
  };
}

async function saveNewsletter(rawBody: NewsletterDTO): Promise<void> {
  const body = sanitizeNewsletterHtmlFields(rawBody);

  const { error: newsletterError } = await supabase
    .from('newsletters')
    .update({
      mast: body.mast,
      edito: body.edito,
      info_box: body.infoBox,
      summer_box: body.summerBox,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id);

  if (newsletterError) {
    throw new Error(`Sauvegarde de la newsletter impossible: ${newsletterError.message}`);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('articles')
    .select('id')
    .eq('newsletter_id', body.id)
    .returns<Array<{ id: string }>>();

  if (existingError) {
    throw new Error(`Lecture des articles existants impossible: ${existingError.message}`);
  }

  const incomingPersistedIds = new Set(
    body.articles.map((a) => a.id).filter(isPersistedId),
  );
  const removedIds = (existingRows ?? [])
    .map((r) => r.id)
    .filter((id) => !incomingPersistedIds.has(id));

  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase.from('articles').delete().in('id', removedIds);
    if (deleteError) {
      throw new Error(`Suppression des articles retirés impossible: ${deleteError.message}`);
    }
  }

  for (const article of body.articles) {
    if (isPersistedId(article.id)) {
      const { error: articleError } = await supabase
        .from('articles')
        .update({
          position: article.position,
          title: article.title,
          image_url: article.imageUrl,
          body: article.body,
          highlight: article.highlight,
          layout: article.layout,
          updated_at: new Date().toISOString(),
        })
        .eq('id', article.id);

      if (articleError) {
        throw new Error(`Sauvegarde de l'article ${article.id} impossible: ${articleError.message}`);
      }

      await insertVersion(article);
    } else {
      const { data, error: insertError } = await supabase
        .from('articles')
        .insert({
          newsletter_id: body.id,
          position: article.position,
          title: article.title,
          image_url: article.imageUrl,
          body: article.body,
          highlight: article.highlight,
          layout: article.layout,
        })
        .select('id')
        .single<{ id: string }>();

      if (insertError || !data) {
        throw new Error(`Création de l'article impossible: ${insertError?.message ?? ''}`);
      }

      await insertVersion({ ...article, id: data.id });
    }
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const newsletter = await loadNewsletter();
    return Response.json(newsletter);
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const rawBody: unknown = await request.json();
    if (!isNewsletterBody(rawBody)) {
      return Response.json({ error: 'Requête invalide' }, { status: 400 });
    }
    await saveNewsletter(rawBody);
    const newsletter = await loadNewsletter();
    return Response.json(newsletter);
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}
