import { supabase } from './_lib/supabase';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth';
import { articleRowToDTO, type ArticleDTO, type ArticleRow } from './_lib/types';

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
    const body = (await request.json()) as {
      newsletterId: string;
      position: number;
      title: string;
      imageUrl: string | null;
      body: string;
      highlight: string | null;
    };

    const { data, error } = await supabase
      .from('articles')
      .insert({
        newsletter_id: body.newsletterId,
        position: body.position,
        title: body.title,
        image_url: body.imageUrl,
        body: body.body,
        highlight: body.highlight,
      })
      .select('*')
      .single<ArticleRow>();

    if (error || !data) throw new Error(`Création de l'article impossible: ${error?.message}`);

    const dto = articleRowToDTO(data);
    await insertVersion(dto);
    return Response.json(dto, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const body = (await request.json()) as ArticleDTO;

    const { data, error } = await supabase
      .from('articles')
      .update({
        position: body.position,
        title: body.title,
        image_url: body.imageUrl,
        body: body.body,
        highlight: body.highlight,
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
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const body = (await request.json()) as { newsletterId: string; orderedIds: string[] };

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
    return Response.json({ error: (err as Error).message }, { status: 500 });
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
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
