import { buildLogoutCookieHeader, buildSessionCookieHeader, createSessionCookieValue } from './_lib/auth.js';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { password?: string };
    const expected = process.env.AUTH_PASSWORD;

    if (!expected) {
      return Response.json({ error: 'AUTH_PASSWORD non configuré' }, { status: 500 });
    }

    if (body.password !== expected) {
      return Response.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }

    const cookieValue = createSessionCookieValue();
    return new Response(null, {
      status: 200,
      headers: { 'Set-Cookie': buildSessionCookieHeader(cookieValue) },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: { 'Set-Cookie': buildLogoutCookieHeader() },
  });
}
