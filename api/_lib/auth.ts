import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE_NAME = 'cfdt_auth';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours
// `Secure` est ignoré par certains navigateurs (Firefox, Safari) sur http://localhost,
// ce qui empêche le cookie d'être posé en dev local avec `vercel dev`.
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET manquant dans les variables d\'environnement.');
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

export function createSessionCookieValue(): string {
  const payload = `session.${Date.now()}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionCookieValue(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot === -1) return false;
  const payload = cookieValue.slice(0, lastDot);
  const signature = cookieValue.slice(lastDot + 1);
  const expected = sign(payload);

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(sigBuf, expectedBuf);
}

export function buildSessionCookieHeader(value: string): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${value}`,
    'HttpOnly',
    ...(IS_PRODUCTION ? ['Secure'] : []),
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  return parts.join('; ');
}

export function buildLogoutCookieHeader(): string {
  const securePart = IS_PRODUCTION ? 'Secure; ' : '';
  return `${AUTH_COOKIE_NAME}=; HttpOnly; ${securePart}SameSite=Lax; Path=/; Max-Age=0`;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}
