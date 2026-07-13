import type { AppSettings, Article, ArticleVersion, BlobImage, Newsletter } from '../state/state';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${input} → ${res.status}`);
  }
  // Réponse de notre propre backend (déjà validée côté serveur) : on fait
  // confiance au contrat de type, contrairement à un body entrant côté API.
  return (await res.json()) as unknown as T;
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

export function listImages(): Promise<BlobImage[]> {
  return request<BlobImage[]>('/api/images');
}

export async function uploadImage(blob: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, filename);
  const res = await fetch('/api/upload-image', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload-image → ${res.status}`);
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function deleteImage(url: string): Promise<void> {
  const res = await fetch(`/api/images?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`images DELETE → ${res.status}`);
}

export function getAppSettings(): Promise<AppSettings> {
  return request<AppSettings>('/api/settings');
}

export function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  return request<AppSettings>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
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
