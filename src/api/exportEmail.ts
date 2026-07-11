import type { Newsletter, Mast, Edito, Article, InfoBox, SummerBox } from '../state/state';

/**
 * Génère le HTML email de la newsletter, calqué sur la maquette de référence
 * (feuille blanche 891px sur fond gris, grille 3 colonnes façon presse, footer
 * pleine largeur orange). Tout en tables + styles inline pour compatibilité
 * clients mail. Les images (Vercel Blob) sont utilisables telles quelles.
 */

// Palette de la maquette email (distincte de la feuille A4 : titres en teal).
const C = {
  orange: '#e8531a',
  orangeDark: '#d94f1e',
  orangeFoot: '#e5510a',
  navy: '#0c2a4d',
  teal: '#0e7c86',
  tealDark: '#0a6570',
  peach: '#fdf3e2',
  pageBg: '#dae5e4',
  ink: '#333333',
  red: '#d43a1e',
} as const;

const FONT_BODY = "'Nunito',Arial,sans-serif";
const FONT_HEAD = "'Montserrat',Arial,sans-serif";

const SHEET_WIDTH = 891;
const COLS = 3;
const COL_WIDTH = 281; // 3 × 281 + 2 × 11 gutter ≈ 865, + marges 12px = 891

// Logos CFDT : PNG hébergés sur Vercel Blob (les SVG de public/ ne sont pas des
// URLs publiques utilisables dans un email). Générés depuis public/cfdt-logo*.svg
// et uploadés via scripts/upload-logos.ts — rejouer ce script si les logos changent.
// `?v=N` : force les clients à ignorer une éventuelle ancienne version en cache
// (les logos ont été régénérés avec transparence). Incrémenter si on les change.
const LOGO_MAST_URL = 'https://hdb2ugcbjiyjqasb.public.blob.vercel-storage.com/logos/cfdt-logo.png?v=3';
const LOGO_FOOTER_URL = 'https://hdb2ugcbjiyjqasb.public.blob.vercel-storage.com/logos/cfdt-logo-footer.png?v=2';

function img(src: string, width: number, extra = ''): string {
  return `<img src="${src}" width="${width}" alt="" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;${extra}">`;
}

/** Pastille ronde orange numérotée (cellule de table, dégradé gracieux Outlook). */
function numPill(n: number): string {
  return (
    `<td width="26" valign="top" style="padding-top:1px;">` +
    `<table role="presentation" width="26" cellpadding="0" cellspacing="0" border="0" style="background:${C.orangeDark};border-radius:50%;"><tr>` +
    `<td align="center" valign="middle" height="26" style="color:#ffffff;font-weight:900;font-size:15px;font-family:${FONT_BODY};">${n}</td>` +
    `</tr></table></td>`
  );
}

/** Carte article blanche arrondie : numéro + titre teal, image, corps, highlight. */
function articleCard(a: Article, index: number): string {
  const image = a.imageUrl
    ? img(a.imageUrl, COL_WIDTH - 24, 'border-radius:6px;margin-bottom:8px;')
    : '';
  const highlight =
    a.highlight != null
      ? `<div style="background:${C.orange};color:#ffffff;border-radius:8px;padding:8px 11px;font-size:10.6px;line-height:1.36;font-weight:700;margin:8px 0 0;">${a.highlight}</div>`
      : '';
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:10px;"><tr><td style="padding:11px 12px 13px 12px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr>` +
    numPill(index + 1) +
    `<td valign="top" style="padding-left:9px;color:${C.teal};font-weight:800;font-size:15.5px;line-height:1.2;font-family:${FONT_BODY};">${a.title}</td>` +
    `</tr></table>` +
    image +
    `<div style="font-size:10.6px;line-height:1.36;color:${C.ink};font-family:${FONT_BODY};">${a.body}</div>` +
    highlight +
    `</td></tr></table>`
  );
}

/** Espacement vertical entre cartes d'une même colonne (fiable cross-client). */
const cardGap = `<div style="height:11px;line-height:11px;font-size:1px;">&nbsp;</div>`;

/**
 * Répartit les articles dans 3 colonnes par round-robin (1,4,7 / 2,5 / 3,6),
 * comme la maquette, puis rend chaque colonne comme une pile de cartes.
 */
function articlesGrid(articles: Article[]): string {
  const columns: string[][] = [[], [], []];
  articles.forEach((a, i) => {
    columns[i % COLS].push(articleCard(a, i));
  });

  const cells = columns
    .map(
      (cards) =>
        `<td class="col" width="${COL_WIDTH}" valign="top">${cards.join(cardGap)}</td>`,
    )
    .join(`<td class="gut" width="11">&nbsp;</td>`);

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    cells +
    `</tr></table>`
  );
}

/** Header : logo + orgLines (gauche) | titre + pill (centre) | mast.image (droite). */
function headerBlock(mast: Mast): string {
  const logo = LOGO_MAST_URL
    ? `<td valign="middle" style="padding-right:8px;"><img src="${LOGO_MAST_URL}" width="78" height="78" alt="CFDT" style="display:block;width:78px;height:78px;border:0;"></td>`
    : '';
  const right = mast.image
    ? `<td class="stack" width="128" valign="top" align="right" style="padding:2px 0 6px 0;">${img(mast.image, 128)}</td>`
    : '';
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td class="stack" width="275" valign="middle" style="padding:2px 0 6px 0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    logo +
    `<td valign="middle" style="font-family:${FONT_HEAD};font-weight:800;color:${C.orange};font-size:12px;line-height:1.35;letter-spacing:.2px;">${mast.orgLines}</td>` +
    `</tr></table></td>` +
    `<td class="stack" valign="top" align="center" style="padding:2px 0 6px 0;text-align:center;">` +
    `<div class="mast-title" style="font-weight:900;font-size:46px;letter-spacing:1px;color:${C.navy};line-height:1.15;margin-top:4px;font-family:${FONT_BODY};text-align:center;">` +
    `<span style="color:${C.orange};">${mast.titleAccent}</span> <span style="white-space:nowrap;">${mast.titleRest}</span></div>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 0 auto;"><tr>` +
    `<td style="background:${C.navy};border-radius:20px;padding:6px 30px 7px 30px;color:#ffffff;font-style:italic;font-weight:800;font-size:19px;letter-spacing:.5px;white-space:nowrap;font-family:${FONT_BODY};">${mast.period}</td>` +
    `</tr></table></td>` +
    right +
    `</tr></table>`
  );
}

/** Intro/édito : soleil (edito.image) à gauche + texte à droite, fond pêche. */
function introBlock(edito: Edito): string {
  const sun = edito.image
    ? `<td width="118" valign="top" align="center" style="padding:14px 0 14px 14px;">${img(edito.image, 96, 'margin:2px auto 0 auto;')}</td>`
    : '';
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.peach};border-radius:12px;margin-bottom:14px;"><tr>` +
    sun +
    `<td valign="top" style="padding:14px 14px 14px 14px;font-size:12.2px;line-height:1.38;font-family:${FONT_BODY};color:${C.ink};">` +
    `<div style="color:${C.orange};font-weight:800;font-size:14px;margin-bottom:4px;">${edito.hello}</div>` +
    `<div>${edito.body}</div>` +
    `<p style="color:${C.orange};font-weight:800;margin:6px 0 0 0;">${edito.signature}</p>` +
    `</td></tr></table>`
  );
}

/** Bas de page : info pratique (icône teal) + encart d'été (pêche), côte à côte. */
function bottomBlock(infoBox: InfoBox, summerBox: SummerBox): string {
  const sun = summerBox.image
    ? `<td width="64" valign="top" style="padding-top:4px;padding-right:14px;">${img(summerBox.image, 64, 'border-radius:6px;')}</td>`
    : '';
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>` +
    // Info pratique
    `<td class="stack" width="277" valign="top">` +
    `<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:10px;"><tr><td style="padding:12px 14px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="46" valign="top" style="padding-right:10px;">` +
    `<table role="presentation" width="46" cellpadding="0" cellspacing="0" border="0" style="background:${C.tealDark};border-radius:50%;"><tr><td width="46" height="46" align="center" valign="middle" style="color:#ffffff;font-size:20px;">&#8505;</td></tr></table>` +
    `</td>` +
    `<td valign="top">` +
    `<h3 style="margin:0 0 3px 0;color:${C.teal};font-weight:800;font-size:13.5px;font-family:${FONT_BODY};">${infoBox.title}</h3>` +
    `<div style="font-size:10.4px;line-height:1.38;color:${C.ink};font-family:${FONT_BODY};">${infoBox.body}</div>` +
    `</td></tr></table>` +
    `</td></tr></table></td>` +
    `<td class="gut" width="12">&nbsp;</td>` +
    // Encart d'été
    `<td class="stack" valign="top">` +
    `<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.peach};border-radius:10px;"><tr><td style="padding:12px 18px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    sun +
    `<td valign="top">` +
    `<h3 style="color:${C.orange};font-weight:800;font-size:18px;margin:0 0 4px 0;line-height:1.1;font-family:${FONT_BODY};">${summerBox.title}</h3>` +
    `<div style="font-size:11px;line-height:1.4;color:${C.ink};font-family:${FONT_BODY};">${summerBox.body}</div>` +
    `<p style="color:${C.orange};font-weight:800;text-align:right;margin:6px 0 0 0;font-family:${FONT_BODY};">${summerBox.signature}</p>` +
    `</td></tr></table>` +
    `</td></tr></table></td>` +
    `</tr></table>`
  );
}

/** Footer pleine largeur orange : texte gauche | logo | texte droite. */
function footerBlock(): string {
  const logo = LOGO_FOOTER_URL
    ? `<td valign="middle" style="padding:0 20px;"><img src="${LOGO_FOOTER_URL}" width="62" height="62" alt="CFDT" style="display:block;width:62px;height:62px;border:0;"></td>`
    : '';
  return (
    `<tr><td style="padding-top:14px;">` +
    `<table role="presentation" class="foot-wrap" width="${SHEET_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="background:${C.orangeFoot};width:${SHEET_WIDTH}px;"><tr>` +
    `<td align="center" style="padding:22px 20px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td valign="middle" style="font-family:${FONT_HEAD};font-weight:800;color:#ffffff;font-size:14.5px;line-height:1.35;letter-spacing:.3px;text-align:right;padding-right:20px;">POUR L'ÉGALITÉ<br>POUR LA JUSTICE SOCIALE</td>` +
    logo +
    `<td valign="middle" style="font-family:${FONT_HEAD};font-weight:800;color:#ffffff;font-size:14.5px;line-height:1.35;letter-spacing:.3px;text-align:left;padding-left:20px;">LA CFDT ENGAGÉE<br>À VOS CÔTÉS</td>` +
    `</tr></table>` +
    `</td></tr></table>` +
    `</td></tr>`
  );
}

// Décor du masthead : reproduit le `::before` de la feuille A4 (`.mast::before`
// dans style.css) — un carré orange clair tourné, débordant dans le coin
// haut-gauche. En `position:absolute` : rendu correctement par les clients qui
// respectent le CSS (Apple Mail, Gmail web/app) ; ignoré gracieusement sinon
// (Outlook desktop), sans casser la mise en page grâce à `overflow:hidden`.
const CORNER_DECOR =
  `<div style="position:absolute;top:-72px;left:-72px;width:150px;height:150px;` +
  `border-radius:40px;background:${C.orange};opacity:.12;transform:rotate(8deg);"></div>`;

export function emailDocumentHTML(state: Newsletter): string {
  const content =
    `<tr><td style="padding:10px 12px 0 12px;position:relative;overflow:hidden;">` +
    CORNER_DECOR +
    headerBlock(state.mast) +
    introBlock(state.edito) +
    articlesGrid(state.articles) +
    bottomBlock(state.infoBox, state.summerBox) +
    `</td></tr>` +
    footerBlock();

  return (
    `<!DOCTYPE html>` +
    `<html lang="fr">` +
    `<head>` +
    `<meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">` +
    `<meta http-equiv="X-UA-Compatible" content="IE=edge">` +
    `<title>ACTU UD CFDT 06</title>` +
    // Polices Google (fallback Arial pour les clients qui les bloquent).
    `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@800&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet">` +
    // Responsive : sous 600px, la feuille devient fluide et toutes les colonnes
    // (articles, header, bas de page) s'empilent en pleine largeur. Supporté par
    // les clients mobiles qui lisent les <style> (Apple Mail, Gmail app, etc.).
    `<style>` +
    `@media only screen and (max-width:600px){` +
    `.sheet{width:100%!important;max-width:100%!important;}` +
    `.col,.stack{display:block!important;width:100%!important;box-sizing:border-box;}` +
    `.gut{display:none!important;width:0!important;}` +
    `.col{margin-bottom:11px;}` +
    `.foot-wrap{width:100%!important;}` +
    `.mast-title{font-size:34px!important;line-height:1.25!important;text-align:center!important;}` +
    `}` +
    `</style>` +
    `</head>` +
    `<body style="margin:0;padding:0;background:${C.pageBg};font-family:${FONT_BODY};color:${C.ink};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pageBg};"><tr><td align="center">` +
    `<!--[if mso]><table role="presentation" width="${SHEET_WIDTH}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
    `<table role="presentation" class="sheet" width="${SHEET_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${SHEET_WIDTH}px;max-width:${SHEET_WIDTH}px;background:#ffffff;">` +
    content +
    `</table>` +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table>` +
    `</body></html>`
  );
}

export function exportEmailHTML(newsletter: Newsletter): void {
  const html = emailDocumentHTML(newsletter);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `newsletter-cfdt-email-${stamp}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
