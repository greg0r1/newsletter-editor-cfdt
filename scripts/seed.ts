/**
 * Seed one-shot : lit le prototype HTML, extrait DEFAULT_STATE, envoie chaque
 * image base64 vers Vercel Blob puis insère la newsletter + ses articles dans Supabase.
 *
 * Usage: node --import tsx scripts/seed.ts
 * Nécessite SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BLOB_READ_WRITE_TOKEN en env.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_PATH = join(__dirname, 'seed-data/prototype.html');

interface PrototypeArticle {
  id: string;
  title: string;
  image: string | null;
  body: string;
  highlight: string | null;
}

interface PrototypeState {
  mast: { orgLines: string; titleAccent: string; titleRest: string; period: string; image: string };
  edito: { hello: string; body: string; signature: string; image: string };
  articles: PrototypeArticle[];
  infoBox: { title: string; body: string };
  summerBox: { title: string; body: string; signature: string; image: string };
}

function extractDefaultState(html: string): PrototypeState {
  const match = html.match(/var DEFAULT_STATE = (\{.*\});\s*\nvar STORAGE_KEY/s);
  if (!match) throw new Error('DEFAULT_STATE introuvable dans le prototype.');
  return JSON.parse(match[1]) as PrototypeState;
}

async function uploadIfDataUrl(value: string | null, pathHint: string): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith('data:')) return value; // déjà une URL

  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error(`Format data URL inattendu pour ${pathHint}`);
  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  const extension = mime.split('/')[1] ?? 'jpg';

  const blob = await put(`${pathHint}.${extension}`, buffer, {
    access: 'public',
    contentType: mime,
    addRandomSuffix: false,
  });
  console.log(`  uploadé: ${pathHint} → ${blob.url}`);
  return blob.url;
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('Lecture du prototype…');
  const html = readFileSync(PROTOTYPE_PATH, 'utf-8');
  const state = extractDefaultState(html);

  console.log('Upload des images vers Vercel Blob…');
  const mastImage = await uploadIfDataUrl(state.mast.image, 'seed/mast');
  const editoImage = await uploadIfDataUrl(state.edito.image, 'seed/edito');
  const summerImage = await uploadIfDataUrl(state.summerBox.image, 'seed/summer');

  const articleImages = await Promise.all(
    state.articles.map((a) => uploadIfDataUrl(a.image, `seed/article-${a.id}`)),
  );

  console.log('Insertion de la newsletter dans Supabase…');
  const { data: newsletterRow, error: newsletterError } = await supabase
    .from('newsletters')
    .insert({
      mast: { ...state.mast, image: mastImage },
      edito: { ...state.edito, image: editoImage },
      info_box: state.infoBox,
      summer_box: { ...state.summerBox, image: summerImage },
    })
    .select('id')
    .single<{ id: string }>();

  if (newsletterError || !newsletterRow) {
    throw new Error(`Insertion newsletter impossible: ${newsletterError?.message}`);
  }

  console.log(`Newsletter créée: ${newsletterRow.id}`);
  console.log('Insertion des articles…');

  for (let i = 0; i < state.articles.length; i++) {
    const article = state.articles[i];
    const { data: articleRow, error: articleError } = await supabase
      .from('articles')
      .insert({
        newsletter_id: newsletterRow.id,
        position: i,
        title: article.title,
        image_url: articleImages[i],
        body: article.body,
        highlight: article.highlight,
      })
      .select('*')
      .single();

    if (articleError || !articleRow) {
      throw new Error(`Insertion article ${article.id} impossible: ${articleError?.message}`);
    }

    await supabase.from('article_versions').insert({
      article_id: articleRow.id,
      snapshot: {
        id: articleRow.id,
        position: articleRow.position,
        title: articleRow.title,
        imageUrl: articleRow.image_url,
        body: articleRow.body,
        highlight: articleRow.highlight,
        updatedAt: articleRow.updated_at,
      },
    });

    console.log(`  article ${i + 1}/${state.articles.length} inséré: ${article.title}`);
  }

  console.log('Seed terminé avec succès.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
