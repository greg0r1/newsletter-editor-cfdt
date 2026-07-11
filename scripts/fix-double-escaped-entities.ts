/**
 * Migration one-shot : répare les champs HTML sur-échappés en base suite au
 * bug de `sanitizeHtml` (voir api/_lib/sanitize.ts) qui ré-échappait le `&`
 * des entités déjà présentes (`&nbsp;`) à chaque sauvegarde. Résultat en
 * base : `&amp;amp;amp;...nbsp;` avec un nombre variable de répétitions
 * selon le nombre de frappes/sauvegardes subies par chaque champ.
 *
 * Stratégie : la corruption ajoutait UNE couche `&amp;` devant chaque entité
 * à chaque sauvegarde (`&nbsp;` → `&amp;nbsp;` → `&amp;amp;nbsp;` → …). On se
 * contente donc d'effondrer ces couches `&amp;` accumulées, PUIS on repasse
 * par `sanitizeHtml` (désormais idempotent) pour repartir d'un état propre.
 * On ne décode PAS complètement les entités : un décodage complet
 * transformerait un `&lt;script&gt;` littéral légitime en vraie balise, que
 * `sanitizeHtml` supprimerait ensuite (perte de contenu). On ne touche qu'aux
 * valeurs montrant la signature claire de corruption (`&amp;amp;`, 2 couches
 * ou plus) : une entité échappée sur un seul niveau (`&amp;nbsp;`) est ambiguë
 * (un « &nbsp; » tapé littéralement produit exactement ça) et est laissée telle
 * quelle plutôt que d'être altérée à tort.
 *
 * Usage: node --import tsx scripts/fix-double-escaped-entities.ts [--dry-run]
 * Nécessite SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY en env (voir .env.local).
 */
import { supabase } from '../api/_lib/supabase.js';
import { sanitizeHtml } from '../api/_lib/sanitize.js';

const DRY_RUN = process.argv.includes('--dry-run');

function fixField(value: string | null): string | null {
  if (!value || !value.includes('&amp;amp;')) return value;
  let previous: string;
  let current = value;
  do {
    previous = current;
    current = current.replace(/&amp;/g, '&');
  } while (current !== previous);
  return sanitizeHtml(current);
}

async function main(): Promise<void> {
  if (DRY_RUN) console.log('--- DRY RUN : aucune écriture ne sera faite ---');

  console.log('Lecture des newsletters…');
  const { data: newsletters, error: newslettersError } = await supabase
    .from('newsletters')
    .select('id, mast, edito, info_box, summer_box');
  if (newslettersError) throw new Error(newslettersError.message);

  for (const nl of newsletters ?? []) {
    const mast = { ...nl.mast, orgLines: fixField(nl.mast.orgLines) };
    const edito = { ...nl.edito, body: fixField(nl.edito.body) };
    const infoBox = { ...nl.info_box, body: fixField(nl.info_box.body) };
    const summerBox = { ...nl.summer_box, body: fixField(nl.summer_box.body) };

    const changed =
      mast.orgLines !== nl.mast.orgLines ||
      edito.body !== nl.edito.body ||
      infoBox.body !== nl.info_box.body ||
      summerBox.body !== nl.summer_box.body;

    if (!changed) continue;

    console.log(`newsletter ${nl.id}: champs corrigés`);
    if (!DRY_RUN) {
      const { error } = await supabase
        .from('newsletters')
        .update({ mast, edito, info_box: infoBox, summer_box: summerBox })
        .eq('id', nl.id);
      if (error) throw new Error(`Update newsletter ${nl.id} impossible: ${error.message}`);
    }
  }

  console.log('Lecture des articles…');
  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('id, title, body, highlight');
  if (articlesError) throw new Error(articlesError.message);

  for (const article of articles ?? []) {
    const title = fixField(article.title) ?? article.title;
    const body = fixField(article.body) ?? article.body;
    const highlight = fixField(article.highlight);

    const changed =
      title !== article.title || body !== article.body || highlight !== article.highlight;

    if (!changed) continue;

    console.log(`article ${article.id}: champs corrigés`);
    if (!DRY_RUN) {
      const { error } = await supabase
        .from('articles')
        .update({ title, body, highlight })
        .eq('id', article.id);
      if (error) throw new Error(`Update article ${article.id} impossible: ${error.message}`);
    }
  }

  console.log(DRY_RUN ? 'Dry run terminé.' : 'Migration terminée avec succès.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
