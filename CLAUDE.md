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
- `api/settings.ts` — GET/PUT du logo et titre du **chrome de l'application**
  (barre d'outils), distinct du contenu de la newsletter. Table `app_settings`,
  singleton forcé par clé primaire fixe (`id boolean primary key default true`,
  contrainte `check(id)`) : pas de SELECT préalable pour trouver la ligne,
  `saveAppSettings` fait un `upsert(...).select().single()` direct (1 aller-
  retour). Ne pas revenir à un id `uuid` + "ligne la plus récente" : c'était
  la version initiale, fragile (risque de duplication silencieuse, dépendait
  d'un seed manuel jamais garanti).
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
- `app_settings` — logo et titre du **chrome de l'application** (barre
  d'outils, hors zone newsletter), distinct de `newsletters`. Singleton forcé
  par clé primaire fixe (`id boolean`), pas par convention — voir section
  Backend ci-dessus. Ne pas confondre avec le logo du masthead de la
  newsletter (fixe, codé en dur) ni celui du pied de page
  (`mast.footerLogoUrl`, contenu éditorial de la newsletter, voir plus bas).
- Le pied de page n'est dans aucune table dédiée : son texte est fixe, codé
  en dur dans le template front, jamais éditable, jamais stocké. Seule
  exception explicite : le logo du pied de page (`mast.footerLogoUrl`) est
  éditable depuis le panneau de l'éditeur (bloc "En-tête"), au même titre que
  les autres champs `mast` — voir "À ne pas faire" pour la nuance exacte.

### Front (`src/`)
Organisé par couche technique, un sous-dossier par responsabilité :
- `src/state/state.ts` — types du modèle de données (Newsletter, Article,
  EditoBlock, InfoBox, SummerBox), miroir du schéma Supabase côté TypeScript.
- `src/render/render.ts` — fonctions de rendu (état → HTML). Utilisées
  uniquement pour le rendu initial (après fetch de `/api/newsletter`),
  l'import, le reset. Les opérations structurelles (ajout/suppression
  d'article, changement d'image, toggle encart) manipulent le DOM directement
  (insertBefore/remove), SANS re-render complet, pour ne pas perdre le focus
  ailleurs sur la page.
- `src/edit/edit.ts` — délégation d'événements (`input`, `click`) + sauvegarde
  debounced (~700ms) à chaque frappe dans un champ `.editable`, qui appelle
  `PUT /api/newsletter` (ou `/api/articles` pour un article précis).
- `src/edit/image.ts` — compression d'image côté client avant upload.
- `src/api/api.ts` — petit client fetch typé vers les routes `/api/*` (pas de
  librairie HTTP superflue, `fetch` natif suffit).
- `src/api/importExport.ts` — export JSON (Blob + lien de téléchargement),
  import JSON (FileReader + validation basique du schéma avant envoi à l'API).
- `src/styles/` — `style.css` (app), `print.css` (règles d'impression, voir
  section dédiée ci-dessous), `boot.css` (écran de chargement initial),
  `theme.css` (palettes de couleurs + mode sombre du chrome, voir section
  Thème/dark mode — **partagé** entre `style.css` et `config/style.css` via
  `@import`, ne pas dupliquer son contenu dans un nouveau fichier).
- `src/main.ts` — point d'entrée, câble les modules ci-dessus entre eux.
- `config/` — page `/config/` (logo + titre du chrome, palette de couleurs,
  mode sombre), suit exactement le pattern du dossier `login/` : `index.html`
  autonome + `main.ts` + `style.css` dédiés, déclarés comme entrée
  supplémentaire dans `vite.config.ts` (`rollupOptions.input`). Protégée par
  le même middleware que le reste du site (aucune exclusion à ajouter).
  Accessible depuis le menu "Plus" de la barre d'outils.
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

## Évolution vers une séparation DDD
Le projet reste volontairement en couches techniques (state / render / edit /
api) tant qu'il n'y a qu'un seul agrégat métier (la Newsletter et ses
Articles) et peu de règles métier. Direction cible à mesure que ça grossit
(nouveaux types de contenu, règles de validation plus riches, invariants
métier) : séparer par responsabilité DDD plutôt que par couche technique pure.
- **Domaine** — règles métier pures, sans DOM ni réseau (ex : validation d'un
  article, contraintes de longueur, règles de pagination/positionnement).
  N'existe pas encore comme dossier dédié : ce type de logique est aujourd'hui
  dilué dans `render.ts`/`edit.ts`. Créer `src/domain/` seulement quand une
  vraie règle métier émerge en dehors du simple mapping DOM ↔ état.
- **Infrastructure** — accès Supabase, Vercel Blob, fetch. Déjà isolée dans
  `api/` (backend, clé service role) et `src/api/` (client front).
- **Présentation** — DOM, contenteditable, délégation d'événements.
  `src/edit/`, `src/render/`.
- Ne pas réorganiser en `src/domain/` / `src/infrastructure/` /
  `src/presentation/` de manière prématurée : ce découpage n'apporte rien tant
  qu'il n'y a qu'un seul agrégat et pas de vraie logique métier à isoler.
  Attendre un signal concret (règle métier qui se répète, validation qui
  grossit) avant de migrer.

## Règles CSS d'impression (validées empiriquement, ne pas changer sans tester)
- `@page { size: A4; margin: 0; }` — les marges visuelles viennent des paddings
  internes (`10mm` de chaque côté, définis dans `style.css`, appliqués aussi
  bien à l'écran qu'à l'impression), pas de la marge de page.
- `.articles` est en CSS Grid à l'écran (`display: grid; grid-template-columns:
  1fr 1fr`, voir section Front/CSS d'impression), pour permettre aux articles
  `layout: 'half'` de s'afficher côte à côte. À l'**impression**, `print.css`
  force `.articles { display: block }` (et `.art-half { grid-column: unset }`) :
  chaque article s'empile en une seule colonne pleine largeur, quel que soit
  son `layout`. Décision explicite (revenue en arrière sur un essai de rendu
  presse 3 colonnes façon `column-count: 3` : ça cassait car `.articles` garde
  `display: grid` de `style.css`, et `column-count` n'a aucun effet sur un
  élément en `display: grid` — Chromium ignorait silencieusement les colonnes).
  Si un mode presse multi-colonnes est retenté un jour, il faudra explicitement
  annuler `display: grid` (ex: `display: block`) en plus de poser `column-count`.
- Chaque article a `break-inside: avoid` (jamais coupé entre deux pages),
  valable indépendamment du mode colonne/bloc.
- Le bloc final (`Informations pratiques` + encart de clôture + pied de page)
  est enveloppé dans un conteneur unique avec `break-inside: avoid`, placé
  **après** le conteneur `.articles` dans le DOM. Résultat : il est toujours
  poussé sur une nouvelle page s'il ne tient pas dans l'espace restant, jamais
  scindé, toujours à la toute fin.
- Le nombre de pages n'est PAS fixé : il dépend du volume de contenu. C'est
  voulu, ne pas essayer de forcer un nombre de pages précis.
- `.art-img` est plafonnée à `max-height: 85mm` à l'impression (via `print.css`)
  pour éviter qu'une image haute ne pousse un article entier sur sa propre page
  à cause de `break-inside: avoid` (recadrage via `object-fit: cover`, déjà en
  place à l'écran).
- Les media queries responsive du chrome de l'éditeur dans `style.css`
  (`@media screen and (max-width: 1150px)` / `760px`, toolbar + edit-panel +
  mise en page mobile) sont explicitement scopées à `screen`. Piège rencontré :
  sans `screen`, elles se déclenchaient aussi à l'impression pour certaines
  largeurs de page, cassant la grille de `.edito` (image empilée au-dessus du
  texte au lieu d'à côté) — toujours scoper à `screen` toute media query pensée
  pour le confort d'affichage du chrome, jamais pour le contenu imprimé.
- `.selectable` (affordance de clic dans l'éditeur, portée par `.edito`, `.art`,
  `.mast`, `.box-info`, `.box-summer` — donc les mêmes éléments qui ont un fond
  de carte coloré) doit voir son `outline`/`cursor` neutralisés à l'impression,
  mais **pas** son `background` global : seul l'état `.selectable.selected`
  (surbrillance bleutée de sélection) doit perdre son fond en print. Piège
  rencontré : `.selectable { background: none !important }` en print.css
  effaçait aussi le fond pêche/orange légitime des cartes.

## Thème de couleurs et mode sombre (chrome de l'application uniquement)
- Portent **uniquement** sur les variables du chrome de l'éditeur (`--accent`,
  `--accent-hover`, `--accent-soft`, `--accent-ring`, `--g0`..`--g9` et les
  rôles dérivés `--app-bg`/`--surface`/`--border`/`--text`/etc.). Ne touchent
  **jamais** aux couleurs figées de la feuille imprimée CFDT (`--orange`,
  `--navy`, `--cream`, `--peach`, `--lav`, `--ink`, `--muted`, `--line`,
  commentées "NE PAS CHANGER" dans `style.css`) : la newsletter imprimée
  rend exactement pareil en mode sombre qu'en mode clair.
- Mécanisme : attributs `data-theme="orange|blue|green|violet"` et
  `data-color-scheme="light|dark"` sur `<html>`, qui activent des blocs
  `:root[data-theme=...]`/`:root[data-color-scheme="dark"]` dans
  `src/styles/theme.css` (fichier partagé, voir section Front). Choix
  stockés en **`localStorage`** (`cfdt-editor-theme`, `cfdt-editor-color-
  scheme`) — préférence d'affichage locale à l'appareil, pas une donnée
  métier de la newsletter, donc ce n'est pas une violation de la règle
  "pas de localStorage comme stockage principal" plus haut. Valeur par
  défaut : `prefers-color-scheme` du système si rien n'est stocké.
- `public/theme-boot.js` applique ces attributs **avant tout paint**
  (anti-flash de contenu non stylé), chargé via `<script src="/theme-boot.js">`
  classique (pas de `type="module"`, donc synchrone/bloquant) dans `index.html`
  et `config/index.html`. Doit rester un fichier statique servi depuis
  `public/` (jamais transformé par Vite/bundlé, jamais un script inline) :
  la CSP du projet (`vercel.json`, `script-src 'self'`) bloque silencieusement
  tout `<script>` inline sans lever d'exception JS catchable — c'est un piège
  déjà rencontré une fois, ne pas réintroduire de script anti-FOUC inline.
  Réagit aussi à `pageshow`/`event.persisted` pour se réappliquer après une
  restauration bfcache (retour arrière navigateur), qui ne réexécute pas les
  scripts classiques du `<head>`.

## Modèle de données (résumé, TypeScript côté front)
```ts
interface Newsletter {
  mast: {
    orgLines: string; titleAccent: string; titleRest: string; period: string;
    image: string;
    footerLogoUrl: string; // logo du pied de page, éditable (voir "À ne pas faire")
  };
  edito: { hello: string; body: string; signature: string; image: string };
  articles: Article[];
  infoBox: { title: string; body: string };
  summerBox: { title: string; body: string; signature: string; image: string };
  // pas de "footer" ici : son texte est fixe, codé en dur dans le template HTML
}

interface AppSettings {
  logoUrl: string;  // logo du chrome de l'appli (barre d'outils), PAS du masthead newsletter
  appTitle: string; // titre affiché à côté du logo dans la barre d'outils
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
- Ne pas rendre le **texte** du pied de page éditable (fixe, codé en dur).
  Exception explicite et volontaire : le **logo** du pied de page
  (`mast.footerLogoUrl`) est éditable depuis le panneau de l'éditeur, comme
  les autres images de `mast` — ne pas le déplacer vers `/config/` (c'est du
  contenu de la newsletter, pas une préférence d'affichage de l'outil) et ne
  pas en faire un nouveau champ dans le panneau distinct de "En-tête".
- Ne pas mélanger le logo/titre du **chrome de l'application**
  (`AppSettings`, page `/config/`, table `app_settings`) avec le contenu
  éditorial de la newsletter (`Newsletter.mast`, éditeur principal, table
  `newsletters`). Ce sont deux agrégats indépendants, avec des cycles de vie
  et des lieux d'édition différents — voir sections dédiées plus haut.
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
