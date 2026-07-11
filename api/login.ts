import { buildLogoutCookieHeader, buildSessionCookieHeader, createSessionCookieValue } from './_lib/auth.js';
import { serverErrorResponse } from './_lib/errors.js';
import { clearAttempts, isRateLimited, recordFailedAttempt } from './_lib/rateLimit.js';
import { isLoginBody } from './_lib/validate.js';

export async function POST(request: Request): Promise<Response> {
  try {
    if (await isRateLimited(request)) {
      return Response.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 });
    }

    const rawBody: unknown = await request.json();
    if (!isLoginBody(rawBody)) {
      return Response.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const body = rawBody;
    const expected = process.env.AUTH_PASSWORD;

    if (!expected) {
      return Response.json({ error: 'AUTH_PASSWORD non configuré' }, { status: 500 });
    }

    if (body.password !== expected) {
      await recordFailedAttempt(request);
      return Response.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }

    await clearAttempts(request);
    const cookieValue = createSessionCookieValue();
    return new Response(null, {
      status: 200,
      headers: { 'Set-Cookie': buildSessionCookieHeader(cookieValue) },
    });
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}

export async function DELETE(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: { 'Set-Cookie': buildLogoutCookieHeader() },
  });
}
