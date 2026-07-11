import { Redis } from '@upstash/redis';

/**
 * Rate limiting du login via Upstash Redis (compteur + expiration atomiques,
 * partagés entre toutes les instances serverless — un `Map` en mémoire de
 * process ne survit pas d'une invocation à l'autre sur Vercel Functions,
 * testé empiriquement : chaque requête y repart avec un compteur vide).
 *
 * Si KV_REST_API_URL/KV_REST_API_TOKEN ne sont pas configurées (intégration
 * Upstash pas encore provisionnée sur ce projet), le rate limiting est
 * désactivé silencieusement plutôt que de bloquer le login : mieux vaut un
 * login fonctionnel sans rate limiting qu'un login cassé faute d'env vars.
 */
const WINDOW_SECONDS = 10 * 60; // 10 minutes
const MAX_ATTEMPTS = 8;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

/** IP du client, telle que transmise par le proxy Vercel. */
function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

function bucketKey(request: Request): string {
  return `login-attempts:${clientIp(request)}`;
}

/** true si cette IP a dépassé le nombre d'essais autorisés sur la fenêtre courante. */
export async function isRateLimited(request: Request): Promise<boolean> {
  if (!redis) return false;
  const count = await redis.get<number>(bucketKey(request));
  return (count ?? 0) >= MAX_ATTEMPTS;
}

/** À appeler après un échec d'authentification pour incrémenter le compteur de cette IP. */
export async function recordFailedAttempt(request: Request): Promise<void> {
  if (!redis) return;
  const key = bucketKey(request);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
}

/** À appeler après un login réussi pour ne pas pénaliser les tentatives suivantes légitimes. */
export async function clearAttempts(request: Request): Promise<void> {
  if (!redis) return;
  await redis.del(bucketKey(request));
}
