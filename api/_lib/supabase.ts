import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans les variables d\'environnement.');
}

export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
