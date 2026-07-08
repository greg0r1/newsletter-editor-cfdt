# CLAUDE.md — Contexte persistant du projet

## Quoi
Application interne (usage restreint, pas de trafic public visé) permettant à
l'UD CFDT 06 de créer/éditer une newsletter A4 imprimable ("ACTU UD CFDT 06"),
avec articles dynamiques (ajout/suppression/réorganisation), historique des
versions, images hébergées, export/import JSON, et un accès protégé par
mot de passe.

## Décisions techniques figées (ne pas reproposer autre chose sans demande explicite)
- **Vite + TypeScript vanilla** côté front. Pas de framework (pas d'Angular,
  pas de React, pas de Next.js). Raison : le cœur de l'app édite du
  `contenteditable` en DOM direct ; un re-render piloté par un framework casse
  le focus/curseur pendant la frappe. L'architecture est "DOM = source de vérité".
- Pas de librairie CSS (pas de Tailwind), CSS pur avec variables `:root`.
- **Supabase (Postgres)** pour les données, **Vercel Blob** pour les images.
  Ne pas proposer localStorage/IndexedDB comme stockage principal : c'était
  l'approche du prototype initial, on en est sortis volontairement pour avoir
  un stockage centralisé (accessible depuis n'importe quel appareil) et un
  historique des versions.
- Déploiement : GitHub → Vercel (déploiement auto à chaque push sur `main`).

## Architecture attendue

### Backend (fonctions serverless Vercel, dossier `api/`)
- `api/newsletter.ts` — GET (état courant complet) / PUT (sauvegarde).
- `api/articles.ts` — CRUD articles (create/update/delete/reorder).
- `api/article-history.ts` — GET historique d'un article, POST restauration
  d'une version antérieure.
- `api/upload-image.ts` — reçoit un fichier, l'envoie à Vercel Blob, renvoie
  l'URL publique à stocker côté front dans l'article.
- `api/login.ts` — vérifie le mot de passe (`process.env.AUTH_PASSWORD`), pose
  un cookie httpOnly signé (`process.env.AUTH_SECRET`).
- Toute la logique d'accès à Supabase reste **côté serveur uniquement**
  (clé service role jamais exposée au navigateur).

### Base de données Supabase (schéma validé, voir `supabase/schema.sql`)
- `newsletters` — une ligne (ou plusieurs si un jour plusieurs éditions en
  parallèle) : `mast`, `edito`, `info_box`, `summer_box` en JSONB (choisi plutôt
  que des colonnes éclatées : ce sont des blocs structurés peu interrogés
  individuellement, JSONB évite une table à 15 colonnes pour peu de bénéfice).
- `articles` — id, newsletter_id, position (ordre), title, image_url, body,
  highlight, updated_at.
- `article_versions` — id, article_id, snapshot (JSONB de l'article complet
  à cet instant), created_at. Une nouvelle ligne à **chaque sauvegarde**,
  jamais de UPDATE qui écrase l'historique. Permet de restaurer une version
  antérieure d'un article.
- Le pied de page n'est dans aucune table : il est fixe, codé en dur dans le
  template front, jamais éditable, jamais stocké.

### Front (`src/`)
- `src/state.ts` — types du modèle de données (Newsletter, Article, EditoBlock,
  InfoBox, SummerBox), miroir du schéma Supabase côté TypeScript.
- `src/render.ts` — fonctions de rendu (état → HTML). Utilisées uniquement pour
  le rendu initial (après fetch de `/api/newsletter`), l'import, le reset. Les
  opérations structurelles (ajout/suppression d'article, changement d'image,
  toggle encart) manipulent le DOM directement (insertBefore/remove), SANS
  re-render complet, pour ne pas perdre le focus ailleurs sur la page.
- `src/edit.ts` — délégation d'événements (`input`, `click`) + sauvegarde
  debounced (~700ms) à chaque frappe dans un champ `.editable`, qui appelle
  `PUT /api/newsletter` (ou `/api/articles` pour un article précis).
- `src/api.ts` — petit client fetch typé vers les routes `/api/*` (pas de
  librairie HTTP superflue, `fetch` natif suffit).
- `src/importExport.ts` — export JSON (Blob + lien de téléchargement),
  import JSON (FileReader + validation basique du schéma avant envoi à l'API).
- `src/print.css` — règles d'impression, voir section dédiée ci-dessous.
- `middleware.ts` à la racine du projet (Routing Middleware Vercel, convention
  2026 : export par défaut `function middleware(request: Request): Response`,
  `export const config = { runtime: 'nodejs', matcher: [...] }`, on continue la
  chaîne avec `next()` de `@vercel/functions` — PAS `NextResponse.next()`, qui
  est spécifique à Next.js). Redirige vers `/login/` si le cookie est absent/
  invalide. Runtime forcé à `nodejs` (pas `edge`, le défaut) car la vérification
  de signature utilise `node:crypto`.
- Les fonctions `api/*.ts` utilisent la convention Web Standard 2026 : exports
  nommés par méthode HTTP (`export async function GET(request: Request)`, etc.)
  retournant un `Response`/`Response.json(...)`. Ne pas utiliser
  `@vercel/node`/`VercelRequest`/`VercelResponse` (ancienne convention) sauf
  besoin spécifique non couvert par l'API Web standard.

## Règles CSS d'impression (validées empiriquement, ne pas changer sans tester)
- `@page { size: A4; margin: 0; }` — les marges visuelles viennent des paddings
  internes (`10mm` de chaque côté), pas de la marge de page. Si un jour la
  marge `@page` n'est plus à 0, tout le calcul de largeur de colonnes change.
- `.articles { column-count: 3; column-gap: 16px; column-fill: auto; }` — c'est
  ce qui permet à Chromium de répartir les articles en 3 colonnes façon presse
  ET de fragmenter automatiquement sur plusieurs pages A4 à l'impression. Testé
  et validé avec du contenu de longueur variable (aucun article coupé).
- Chaque article a `break-inside: avoid` (jamais coupé entre deux colonnes/pages).
- Le bloc final (`Informations pratiques` + encart de clôture + pied de page)
  est enveloppé dans un conteneur unique avec `break-inside: avoid`, placé
  **après** le conteneur `.articles` dans le DOM. Résultat : il est toujours
  poussé sur une nouvelle page s'il ne tient pas dans l'espace restant, jamais
  scindé, toujours à la toute fin. Ne jamais le mettre à l'intérieur du
  conteneur `.articles` (ça casserait la fragmentation en colonnes).
- Le nombre de pages n'est PAS fixé : il dépend du volume de contenu. C'est
  voulu, ne pas essayer de forcer un nombre de pages précis.

## Modèle de données (résumé, TypeScript côté front)
```ts
interface Newsletter {
  mast: { orgLines: string; titleAccent: string; titleRest: string; period: string; image: string };
  edito: { hello: string; body: string; signature: string; image: string };
  articles: Article[];
  infoBox: { title: string; body: string };
  summerBox: { title: string; body: string; signature: string; image: string };
  // pas de "footer" ici : il est fixe, codé en dur dans le template HTML
}

interface Article {
  id: string;
  position: number;
  title: string;      // HTML autorisé (ex: <sup>e</sup>)
  imageUrl: string | null;  // URL Vercel Blob, jamais de base64 stocké en BDD
  body: string;        // HTML (paragraphes, <strong>, <ul><li>)
  highlight: string | null; // encart mis en avant, optionnel
  updatedAt: string;
}
```

## Images
- Upload → envoyé à `/api/upload-image` → stocké sur **Vercel Blob** → l'URL
  renvoyée est ce qui est sauvegardé dans `articles.image_url` (ou dans le champ
  `image` de `mast`/`edito`/`summer_box` selon le bloc concerné).
- Compression côté client (canvas, largeur max ~560px, JPEG qualité ~0.8) avant
  l'upload, pour limiter la taille des fichiers stockés.
- Toutes les images sont éditables, y compris celles du masthead, de l'édito et
  de l'encart de clôture (summerBox) — décision explicite alignée sur le
  prototype de référence, qui permet déjà de changer ces trois images. Leurs
  URLs sont stockées dans les colonnes JSONB `newsletters.mast` / `edito` /
  `summer_box`. Ne pas revenir à des visuels fixes sans demande explicite.
- Les images du prototype initial (masthead, soleil, photos d'articles) étaient
  en base64 inline dans le HTML : migrées vers Vercel Blob une seule fois via
  `scripts/seed.ts`, jamais rejouées telles quelles en base ensuite.

## Authentification
- Un seul mot de passe partagé (`AUTH_PASSWORD`), pas de comptes utilisateurs,
  pas de table `users`. Cookie httpOnly signé (`AUTH_SECRET`) après connexion
  réussie via `/api/login`. Middleware qui protège tout le reste du site.

## À ne pas faire
- Ne pas introduire de framework front (Angular/React/Vue) sans demande explicite.
- Ne pas transformer les champs `contenteditable` en `<input>`/`<textarea>`
  contrôlés par un state réactif (perte de focus garantie).
- Ne pas rendre le pied de page éditable.
- Ne pas stocker d'images en base64 dans Supabase : toujours via Vercel Blob + URL.
- Ne pas écraser l'historique : chaque sauvegarde d'article crée une nouvelle
  ligne dans `article_versions`, jamais un simple UPDATE qui perd l'ancien état.
- Ne pas committer de secret (mot de passe, clé de signature, clé Supabase) dans
  le repo : tout passe par les variables d'environnement Vercel.
- Ne pas appeler Supabase directement depuis le navigateur (clé service role
  côté serveur uniquement, jamais exposée au bundle front).
- Ne pas supprimer `break-inside:avoid` ni la structure `.tail` sans re-tester
  la pagination avec du contenu de longueur variable (court + long + beaucoup
  d'articles) avant/après.

## Style de code
- TypeScript strict (`strict: true` dans tsconfig).
- Petites fonctions pures quand possible, séparation claire des responsabilités
  (lecture DOM / écriture DOM / logique métier / accès API / accès données).
- Pas de dépendances superflues : vérifier avant d'ajouter un package si ce
  n'est pas déjà faisable simplement en vanilla.
