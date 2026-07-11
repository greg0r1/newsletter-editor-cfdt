import DOMPurify from 'isomorphic-dompurify';

/**
 * Liste blanche des balises/attributs réellement produits par la barre de
 * formatage du panneau (voir `src/edit/panel/icons.ts` FORMAT_BUTTONS) :
 * gras, italique, souligné, listes, alignement, lien, couleur de texte,
 * exposant (`<sup>` utilisé dans les titres, ex. "51<sup>e</sup> Congrès").
 * Tout le reste (script, iframe, on*, style arbitraire, etc.) est retiré.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'span', 'sup', 'sub',
];
const ALLOWED_ATTR = ['href', 'style'];

/**
 * Sanitize le HTML stocké pour un champ éditable (title, body, highlight,
 * mastOrg, editoBody, infoBody, summerBody). Appelé côté serveur juste avant
 * l'écriture en base : c'est la seule barrière fiable, le front ne doit pas
 * être la seule ligne de défense contre le XSS stocké.
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
}
