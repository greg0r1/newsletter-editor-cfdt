import { supabase } from './_lib/supabase.js';
import { parseCookies, verifySessionCookieValue, AUTH_COOKIE_NAME } from './_lib/auth.js';
import { serverErrorResponse } from './_lib/errors.js';
import { appSettingsRowToDTO, type AppSettingsDTO, type AppSettingsRow } from './_lib/types.js';
import { isAppSettingsBody } from './_lib/validate.js';

function requireAuth(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
  return verifySessionCookieValue(cookies[AUTH_COOKIE_NAME]);
}

// `app_settings` est un singleton forcé par une clé primaire fixe
// (`id = true`, voir supabase/schema.sql) : pas besoin de SELECT préalable
// pour retrouver l'id de la ligne, un upsert par clé connue suffit et
// fonctionne même si la ligne n'a jamais été créée (pas de dépendance à un
// seed manuel).
const SETTINGS_ID = true;

async function loadAppSettings(): Promise<AppSettingsDTO> {
  const { data: row, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .single<AppSettingsRow>();

  if (error || !row) {
    throw new Error(`Configuration introuvable: ${error?.message ?? 'aucune ligne'}`);
  }

  return appSettingsRowToDTO(row);
}

async function saveAppSettings(body: AppSettingsDTO): Promise<AppSettingsDTO> {
  const { data: row, error } = await supabase
    .from('app_settings')
    .upsert({
      id: SETTINGS_ID,
      logo_url: body.logoUrl,
      app_title: body.appTitle.trim(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single<AppSettingsRow>();

  if (error || !row) {
    throw new Error(`Sauvegarde de la configuration impossible: ${error?.message ?? 'aucune ligne'}`);
  }

  return appSettingsRowToDTO(row);
}

export async function GET(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const settings = await loadAppSettings();
    return Response.json(settings);
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!requireAuth(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const rawBody: unknown = await request.json();
    if (!isAppSettingsBody(rawBody)) {
      return Response.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const settings = await saveAppSettings(rawBody);
    return Response.json(settings);
  } catch (err) {
    console.error(err);
    return serverErrorResponse();
  }
}
