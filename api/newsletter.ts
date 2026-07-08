import { supabase } from './_lib/supabase.js';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth.js';
import { newsletterRowToDTO, type ArticleRow, type NewsletterDTO, type NewsletterRow } from './_lib/types.js';

function requireAuth(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  return verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);
}

async function loadNewsletter(): Promise<NewsletterDTO> {
  const { data: newsletterRow, error: newsletterError } = await supabase
    .from('newsletters')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single<NewsletterRow>();

  if (newsletterError || !newsletterRow) {
    throw new Error(`Newsletter introuvable: ${newsletterError?.message ?? 'aucune ligne'}`);
  }

  const { data: articleRows, error: articlesError } = await supabase
    .from('articles')
    .select('*')
    .eq('newsletter_id', newsletterRow.id)
    .order('position', { ascending: true })
    .returns<ArticleRow[]>();

  if (articlesError) {
    throw new Error(`Chargement des articles impossible: ${articlesError.message}`);
  }

  return newsletterRowToDTO(newsletterRow, articleRows ?? []);
}

async function saveNewsletter(body: NewsletterDTO): Promise<void> {
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

  for (const article of body.articles) {
    const { error: articleError } = await supabase
      .from('articles')
      .update({
        position: article.position,
        title: article.title,
        image_url: article.imageUrl,
        body: article.body,
        highlight: article.highlight,
        updated_at: new Date().toISOString(),
      })
      .eq('id', article.id);

    if (articleError) {
      throw new Error(`Sauvegarde de l'article ${article.id} impossible: ${articleError.message}`);
    }

    const { error: versionError } = await supabase.from('article_versions').insert({
      article_id: article.id,
      snapshot: article,
    });

    if (versionError) {
      throw new Error(`Écriture de l'historique impossible: ${versionError.message}`);
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
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const body = (await request.json()) as NewsletterDTO;
    await saveNewsletter(body);
    const newsletter = await loadNewsletter();
    return Response.json(newsletter);
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
