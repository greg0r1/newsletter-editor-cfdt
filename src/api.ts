import type { Article, ArticleVersion, Newsletter } from './state';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${input} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getNewsletter(): Promise<Newsletter> {
  return request<Newsletter>('/api/newsletter');
}

export function saveNewsletter(newsletter: Newsletter): Promise<Newsletter> {
  return request<Newsletter>('/api/newsletter', {
    method: 'PUT',
    body: JSON.stringify(newsletter),
  });
}

export function createArticle(
  newsletterId: string,
  article: Omit<Article, 'id' | 'updatedAt'>,
): Promise<Article> {
  return request<Article>('/api/articles', {
    method: 'POST',
    body: JSON.stringify({ newsletterId, ...article }),
  });
}

export function updateArticle(article: Article): Promise<Article> {
  return request<Article>('/api/articles', {
    method: 'PUT',
    body: JSON.stringify(article),
  });
}

export function deleteArticleRequest(articleId: string): Promise<void> {
  return request<void>(`/api/articles?id=${encodeURIComponent(articleId)}`, {
    method: 'DELETE',
  });
}

export function reorderArticles(newsletterId: string, orderedIds: string[]): Promise<void> {
  return request<void>('/api/articles', {
    method: 'PATCH',
    body: JSON.stringify({ newsletterId, orderedIds }),
  });
}

export function getArticleHistory(articleId: string): Promise<ArticleVersion[]> {
  return request<ArticleVersion[]>(`/api/article-history?articleId=${encodeURIComponent(articleId)}`);
}

export function restoreArticleVersion(articleId: string, versionId: string): Promise<Article> {
  return request<Article>('/api/article-history', {
    method: 'POST',
    body: JSON.stringify({ articleId, versionId }),
  });
}

export async function uploadImage(blob: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, filename);
  const res = await fetch('/api/upload-image', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload-image → ${res.status}`);
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function login(password: string): Promise<void> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Mot de passe incorrect');
}

export async function logout(): Promise<void> {
  await fetch('/api/login', { method: 'DELETE' });
}
