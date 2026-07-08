# ACTU UD CFDT 06 — Éditeur de newsletter

Application interne d'édition d'une newsletter A4 imprimable pour l'UD CFDT 06.
Vite + TypeScript vanilla côté front (pas de framework), fonctions serverless
Vercel côté API, Supabase (Postgres) pour les données, Vercel Blob pour les images.

Voir [CLAUDE.md](./CLAUDE.md) pour le contexte détaillé et les décisions figées.

## Prérequis

- Node.js 20+
- Un compte Vercel avec les intégrations Marketplace **Supabase** et **Vercel Blob** activées sur le projet

## Installation locale

```bash
npm install
cp .env.example .env.local
# renseigner les variables dans .env.local (voir ci-dessous)
```

### Base de données

1. Créer le projet Supabase (via l'intégration Vercel Marketplace, plan gratuit).
2. Exécuter [`supabase/schema.sql`](./supabase/schema.sql) dans le SQL Editor de Supabase.
3. (Optionnel) Peupler avec les données du prototype de référence :

   ```bash
   npm run seed
   ```

   Ce script lit `scripts/seed-data/prototype.html`, envoie chaque image
   base64 vers Vercel Blob, et insère la newsletter + ses articles dans Supabase.
   À lancer une seule fois, avec `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et
   `BLOB_READ_WRITE_TOKEN` déjà présents dans l'environnement local.

### Lancer en développement

```bash
npm run dev
```

Le front est servi par Vite ; les fonctions `/api/*` nécessitent `vercel dev`
pour fonctionner localement (Vite seul ne les exécute pas) :

```bash
npx vercel dev
```

## Variables d'environnement

| Variable | Description |
| --- | --- |
| `AUTH_PASSWORD` | Mot de passe partagé pour accéder à l'application |
| `AUTH_SECRET` | Secret utilisé pour signer le cookie de session (chaîne aléatoire longue) |
| `SUPABASE_URL` | Générée automatiquement par l'intégration Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Générée automatiquement par l'intégration Supabase (jamais exposée au front) |
| `BLOB_READ_WRITE_TOKEN` | Générée automatiquement par l'intégration Vercel Blob |

## Build

```bash
npm run build
```

## Déploiement

1. Pousser le repo sur GitHub.
2. Importer le projet dans Vercel (déploiement automatique à chaque push sur `main`).
3. Dans le dashboard Vercel du projet :
   - Ajouter l'intégration Marketplace **Supabase** (Database Providers) → génère `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
   - Ajouter l'intégration **Vercel Blob** (Storage) → génère `BLOB_READ_WRITE_TOKEN`.
   - Renseigner manuellement `AUTH_PASSWORD` et `AUTH_SECRET` dans Settings → Environment Variables.
4. Exécuter `supabase/schema.sql` dans le projet Supabase provisionné.
5. (Optionnel) Lancer `npm run seed` en local avec les variables d'environnement de prod pour peupler la base initiale.

## Structure du projet

```
api/            fonctions serverless (newsletter, articles, historique, upload, login)
src/            front Vite/TS (state, rendu DOM, édition, client API, import/export)
login/          page de connexion (entrée Vite séparée)
supabase/       schéma SQL
scripts/        script de seed one-shot
middleware.ts   protection par cookie de session, à la racine
```
