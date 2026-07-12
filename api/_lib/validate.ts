import type { ArticleDTO, NewsletterDTO } from './types.js';

export interface LoginBody {
  password: string;
}

export function isLoginBody(value: unknown): value is LoginBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.password === 'string';
}

export interface CreateArticleBody {
  newsletterId: string;
  position: number;
  title: string;
  imageUrl: string | null;
  body: string;
  highlight: string | null;
}

export function isCreateArticleBody(value: unknown): value is CreateArticleBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.newsletterId === 'string' &&
    typeof v.position === 'number' &&
    typeof v.title === 'string' &&
    (typeof v.imageUrl === 'string' || v.imageUrl === null) &&
    typeof v.body === 'string' &&
    (typeof v.highlight === 'string' || v.highlight === null)
  );
}

export interface UpdateArticleBody {
  id: string;
  position: number;
  title: string;
  imageUrl: string | null;
  body: string;
  highlight: string | null;
}

export function isUpdateArticleBody(value: unknown): value is UpdateArticleBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.position === 'number' &&
    typeof v.title === 'string' &&
    (typeof v.imageUrl === 'string' || v.imageUrl === null) &&
    typeof v.body === 'string' &&
    (typeof v.highlight === 'string' || v.highlight === null)
  );
}

export interface ReorderArticlesBody {
  newsletterId: string;
  orderedIds: string[];
}

export function isReorderArticlesBody(value: unknown): value is ReorderArticlesBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.newsletterId === 'string' &&
    Array.isArray(v.orderedIds) &&
    v.orderedIds.every((id) => typeof id === 'string')
  );
}

export interface RestoreArticleVersionBody {
  articleId: string;
  versionId: string;
}

export function isRestoreArticleVersionBody(value: unknown): value is RestoreArticleVersionBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.articleId === 'string' && typeof v.versionId === 'string';
}

function isBlockWithBody(value: unknown): value is { body: string } {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).body === 'string';
}

function isArticleDTOShape(value: unknown): value is ArticleDTO {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.position === 'number' &&
    typeof v.title === 'string' &&
    (typeof v.imageUrl === 'string' || v.imageUrl === null) &&
    typeof v.body === 'string' &&
    (typeof v.highlight === 'string' || v.highlight === null) &&
    typeof v.updatedAt === 'string'
  );
}

export function isNewsletterBody(value: unknown): value is NewsletterDTO {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    isBlockWithBody(v.edito) &&
    isBlockWithBody(v.infoBox) &&
    isBlockWithBody(v.summerBox) &&
    typeof v.mast === 'object' &&
    v.mast !== null &&
    Array.isArray(v.articles) &&
    v.articles.every(isArticleDTOShape)
  );
}
