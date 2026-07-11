/**
 * Liste blanche des balises/attributs réellement produits par la barre de
 * formatage du panneau (voir `src/edit/panel/icons.ts` FORMAT_BUTTONS) :
 * gras, italique, souligné, listes, alignement, lien, couleur de texte,
 * exposant (`<sup>` utilisé dans les titres, ex. "51<sup>e</sup> Congrès").
 * Tout le reste (script, iframe, on*, style arbitraire, etc.) est retiré.
 *
 * Sanitizer maison sans dépendance npm : isomorphic-dompurify (→ jsdom →
 * html-encoding-sniffer) puis sanitize-html (→ htmlparser2) ont toutes deux
 * une dépendance transitive publiée en pur ESM que le bundler de fonctions
 * Vercel ne sait pas charger via require() (ERR_REQUIRE_ESM en prod, la
 * fonction crashe au chargement du module). La liste blanche ici est fixe
 * et volontairement restreinte, un petit tokenizer suffit à la couvrir de
 * façon fiable sans tirer de dépendance externe.
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'span', 'sup', 'sub',
]);
const ALLOWED_ATTR = new Set(['href', 'style']);
const VOID_TAGS = new Set(['br']);
const ALLOWED_HREF_RE = /^(?:https?:|mailto:)/i;

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseAttributes(raw: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrRe = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs.set(name, decodeEntities(value));
  }
  return attrs;
}

function sanitizeAttributes(tag: string, attrs: Map<string, string>): string {
  let out = '';
  for (const name of ALLOWED_ATTR) {
    if (!attrs.has(name)) continue;
    const value = attrs.get(name) as string;
    if (name === 'href') {
      if (tag !== 'a' || !ALLOWED_HREF_RE.test(value.trim())) continue;
    }
    if (name === 'style') {
      // Pas de propriétés arbitraires (ex. `expression()`, `url()` d'exfiltration) :
      // seule la couleur de texte est produite par le panneau (voir icons.ts).
      if (!/^color\s*:\s*#[0-9a-fA-F]{3,8}\s*;?\s*$/.test(value.trim())) continue;
    }
    const escapedValue = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    out += ` ${name}="${escapedValue}"`;
  }
  return out;
}

/**
 * Sanitize le HTML stocké pour un champ éditable (title, body, highlight,
 * mastOrg, editoBody, infoBody, summerBody). Appelé côté serveur juste avant
 * l'écriture en base : c'est la seule barrière fiable, le front ne doit pas
 * être la seule ligne de défense contre le XSS stocké.
 */
const STRIPPED_WITH_CONTENT_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

export function sanitizeHtml(input: string): string {
  const withoutDangerousBlocks = input.replace(STRIPPED_WITH_CONTENT_RE, '');
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let out = '';
  let lastIndex = 0;
  const openStack: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(withoutDangerousBlocks)) !== null) {
    out += escapeText(withoutDangerousBlocks.slice(lastIndex, match.index));
    lastIndex = tagRe.lastIndex;

    const [full, rawTag, rawAttrs] = match;
    const tag = rawTag.toLowerCase();
    const isClosing = full.startsWith('</');
    const isSelfClosing = /\/\s*$/.test(rawAttrs);

    if (!ALLOWED_TAGS.has(tag)) continue;

    if (isClosing) {
      const idx = openStack.lastIndexOf(tag);
      if (idx === -1) continue;
      while (openStack.length > idx) {
        out += `</${openStack.pop()}>`;
      }
      continue;
    }

    const attrs = parseAttributes(rawAttrs);
    const attrString = sanitizeAttributes(tag, attrs);

    if (VOID_TAGS.has(tag)) {
      out += `<${tag}${attrString}>`;
    } else if (isSelfClosing) {
      out += `<${tag}${attrString}></${tag}>`;
    } else {
      out += `<${tag}${attrString}>`;
      openStack.push(tag);
    }
  }
  out += escapeText(withoutDangerousBlocks.slice(lastIndex));

  while (openStack.length > 0) {
    out += `</${openStack.pop()}>`;
  }

  return out;
}
