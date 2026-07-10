#!/bin/sh
# Orchestre le dev complet : récupère les variables d'env Vercel puis lance
# `vercel dev` (front Vite + fonctions serverless api/*.ts). Indirection via
# ce script car `vercel dev` refuse de démarrer s'il détecte la sous-chaîne
# "vercel dev" dans le script npm "dev" lui-même (garde-fou anti-récursion).
set -e
npx vercel env pull .env.local
npx vercel dev
