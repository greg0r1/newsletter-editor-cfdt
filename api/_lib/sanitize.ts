import sanitizeHtmlLib from 'sanitize-html';

/**
 * Liste blanche des balises/attributs réellement produits par la barre de
 * formatage du panneau (voir `src/edit/panel/icons.ts` FORMAT_BUTTONS) :
 * gras, italique, souligné, listes, alignement, lien, couleur de texte,
 * exposant (`<sup>` utilisé dans les titres, ex. "51<sup>e</sup> Congrès").
 * Tout le reste (script, iframe, on*, style arbitraire, etc.) est retiré.
 *
 * sanitize-html plutôt que isomorphic-dompurify : ce dernier entraîne jsdom,
 * qui casse au runtime sur Vercel (require() CJS d'un module ESM transitif
 * dans html-encoding-sniffer). sanitize-html est un parseur pur JS (htmlparser2),
 * sans émulation DOM, donc sans ce problème.
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
  return sanitizeHtmlLib(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ALLOWED_ATTR, span: ALLOWED_ATTR },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}
