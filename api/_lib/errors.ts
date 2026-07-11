/**
 * Réponse 500 générique : le détail de `err` (potentiellement des fragments
 * de message Postgres/Supabase — noms de colonnes, contraintes) part dans les
 * logs serveur (`console.error`, déjà fait par chaque appelant) mais jamais
 * dans la réponse HTTP, pour ne pas exposer la structure interne au client.
 */
export function serverErrorResponse(): Response {
  return Response.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
}
