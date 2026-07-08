-- Schéma validé — voir CLAUDE.md avant de le modifier.
-- À exécuter dans Supabase (SQL Editor) après provisionnement de l'intégration.

create extension if not exists pgcrypto;

create table if not exists newsletters (
  id uuid primary key default gen_random_uuid(),
  mast jsonb not null,
  edito jsonb not null,
  info_box jsonb not null,
  summer_box jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references newsletters(id) on delete cascade,
  position int not null,
  title text not null,
  image_url text,
  body text not null,
  highlight text,
  updated_at timestamptz not null default now()
);
create index if not exists articles_newsletter_id_position_idx on articles(newsletter_id, position);

create table if not exists article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists article_versions_article_id_created_at_idx on article_versions(article_id, created_at desc);

-- RLS : aucun accès client (anon/authenticated) n'est prévu, tout passe par
-- les fonctions serverless api/* avec la clé service_role (qui bypass RLS).
-- Activer RLS sans policy ferme donc l'accès à la clé anon si elle fuitait,
-- sans rien changer côté serveur.
alter table newsletters enable row level security;
alter table articles enable row level security;
alter table article_versions enable row level security;
