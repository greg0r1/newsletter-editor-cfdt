import type {
  Newsletter,
  Mast,
  Edito,
  Article,
  InfoBox,
  SummerBox,
} from "../state/state";

/**
 * Génère le HTML email de la newsletter, calqué sur la maquette de référence
 * (feuille blanche 891px sur fond gris, articles empilés en une seule colonne,
 * footer pleine largeur orange). Tout en tables + styles inline pour
 * compatibilité clients mail. Les images (Vercel Blob) sont utilisables
 * telles quelles.
 */

// Palette de la maquette email (distincte de la feuille A4 : titres en teal).
const C = {
  orange: "#e8531a",
  orangeDark: "#d94f1e",
  orangeFoot: "#e5510a",
  navy: "#0c2a4d",
  teal: "#0e7c86",
  tealDark: "#0a6570",
  peach: "#fdede2",
  lav: "#f3f0f6",
  pageBg: "#dae5e4",
  ink: "#333333",
  red: "#d43a1e",
} as const;

const FONT_BODY = "'Nunito',Arial,sans-serif";
const FONT_HEAD = "'Montserrat',Arial,sans-serif";

const SHEET_WIDTH = 891;

// Logos CFDT : PNG hébergés sur Vercel Blob (les SVG de public/ ne sont pas des
// URLs publiques utilisables dans un email). Générés depuis public/cfdt-logo*.svg
// et uploadés via scripts/upload-logos.ts — rejouer ce script si les logos changent.
// `?v=N` : force les clients à ignorer une éventuelle ancienne version en cache
// (les logos ont été régénérés avec transparence). Incrémenter si on les change.
const LOGO_MAST_URL =
  "https://hdb2ugcbjiyjqasb.public.blob.vercel-storage.com/logos/cfdt-logo.png?v=3";
const LOGO_FOOTER_URL =
  "https://hdb2ugcbjiyjqasb.public.blob.vercel-storage.com/logos/cfdt-logo-footer.png?v=2";
const LOGO_MEGAPHONE_URL =
  "https://hdb2ugcbjiyjqasb.public.blob.vercel-storage.com/logos/mast-megaphone.png?v=1";

function img(src: string, width: number, extra = ""): string {
  return `<img src="${src}" width="${width}" alt="" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;${extra}">`;
}

/** Pastille ronde orange numérotée (cellule de table, dégradé gracieux Outlook). */
function numPill(n: number): string {
  return (
    `<td width="30" valign="top" style="padding-top:1px;">` +
    `<table role="presentation" width="30" cellpadding="0" cellspacing="0" border="0" style="background:${C.orangeDark};border-radius:50%;"><tr>` +
    `<td align="center" valign="middle" height="30" style="color:#ffffff;font-weight:900;font-size:17px;font-family:${FONT_BODY};">${n}</td>` +
    `</tr></table></td>`
  );
}

/** Carte article blanche arrondie : numéro + titre teal, image, corps, highlight. */
function articleCard(a: Article, index: number, cardWidth: number): string {
  const image = a.imageUrl
    ? img(a.imageUrl, cardWidth - 40, "border-radius:6px;margin-bottom:10px;")
    : "";
  const highlight =
    a.highlight != null
      ? `<div style="background:${C.orange};color:#ffffff;border-radius:8px;padding:10px 14px;font-size:13.5px;line-height:1.4;font-weight:700;margin:10px 0 0;">${a.highlight}</div>`
      : "";
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.peach};border-radius:10px;"><tr><td style="padding:16px 20px 18px 20px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;"><tr>` +
    numPill(index + 1) +
    `<td class="et-title" valign="top" style="padding-left:10px;color:${C.teal};font-weight:800;font-size:19px;line-height:1.25;font-family:${FONT_BODY};">${a.title}</td>` +
    `</tr></table>` +
    image +
    `<div class="et-body" style="font-size:14.5px;line-height:1.5;color:${C.ink};font-family:${FONT_BODY};">${a.body}</div>` +
    highlight +
    `</td></tr></table>`
  );
}

/** Espacement vertical entre cartes d'une même colonne (fiable cross-client). */
const cardGap = `<div style="height:11px;line-height:11px;font-size:1px;">&nbsp;</div>`;

/** Empile tous les articles en une seule colonne pleine largeur. */
function articlesGrid(articles: Article[]): string {
  const cards = articles.map((a, i) => articleCard(a, i, SHEET_WIDTH - 24));
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td class="col" valign="top">${cards.join(cardGap)}</td>` +
    `</tr></table>`
  );
}

/**
 * Header : reproduit le masthead écran (.mast dans style.css) — logo rond +
 * titre centrés sur une première ligne, puis soleil + mégaphone + pilule
 * orange contourée sur fond pêche centrés sur une seconde ligne.
 */
function headerBlock(mast: Mast): string {
  const logo = LOGO_MAST_URL
    ? `<td class="hdr-cell" width="78" valign="middle" align="center" style="padding:0 25px 8px 0;"><img src="${LOGO_MAST_URL}" width="78" height="78" alt="CFDT" style="display:block;width:78px;height:78px;border:0;margin:0 auto;"></td>`
    : "";
  const title =
    mast.titleMode === "image" && mast.titleImageUrl
      ? `<img src="${mast.titleImageUrl}" alt="${mast.title}" style="display:block;max-width:100%;height:auto;margin:0 auto;">`
      : `<div class="mast-title" style="font-weight:900;font-size:40px;letter-spacing:1px;color:${C.navy};line-height:1.15;font-family:${FONT_BODY};text-align:center;">${mast.title}</div>`;
  const sun = mast.image
    ? `<td class="hdr-row2 sun" width="72" valign="middle" align="center" style="padding:0 10px 0 0;">${img(mast.image, 72, "margin:0 auto;")}</td>`
    : "";
  const megaphone = LOGO_MEGAPHONE_URL
    ? `<td class="hdr-row2 mega" width="58" valign="middle" align="center" style="padding:0 6px 0 0;"><img src="${LOGO_MEGAPHONE_URL}" width="58" alt="" style="display:block;width:58px;height:auto;border:0;transform:rotate(-8deg);margin:0 auto;"></td>`
    : "";
  const sparkles =
    `<td class="hdr-row2" width="18" valign="top" style="padding-left:2px;">` +
    `<svg width="25" height="22" viewBox="0 0 30 26" fill="${C.orange}" style="display:block;transform:rotate(45deg);margin-top:-15px;margin-left:-10px">` +
    `<rect x="1" y="10" width="5" height="14" rx="2.5" transform="rotate(-28 3.5 17)"/>` +
    `<rect x="12.5" y="6" width="5" height="16" rx="2.5"/>` +
    `<rect x="24" y="10" width="5" height="14" rx="2.5" transform="rotate(28 26.5 17)"/>` +
    `</svg>` +
    `</td>`;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr>` +
    `<td align="center" style="padding:2px 0 6px 0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    logo +
    `<td class="hdr-cell" valign="middle" align="center" style="padding-bottom:8px;">${title}</td>` +
    `</tr></table>` +
    `</td></tr><tr><td align="center" style="padding-bottom:6px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    sun +
    megaphone +
    `<td class="hdr-row2 pill" valign="middle" align="center" style="background:${C.peach};border:2px solid ${C.orange};border-radius:20px;padding:6px 26px 7px 26px;color:${C.orange};font-style:italic;font-weight:800;font-size:19px;letter-spacing:.5px;font-family:${FONT_BODY};">${mast.period}</td>` +
    sparkles +
    `</tr></table>` +
    `</td></tr></table>`
  );
}

/**
 * Intro/édito : soleil (edito.image) à gauche + texte à droite, fond pêche.
 * En mobile (<600px), le corps + signature basculent sous la ligne
 * soleil/salutation, pleine largeur (voir classes .edito-body-inline /
 * .edito-body-stack et la règle @media associée).
 */
function introBlock(edito: Edito): string {
  const sun = edito.image
    ? `<td class="edito-sun" width="118" valign="top" align="center" style="padding:14px 0 14px 14px;">${img(edito.image, 96, "margin:2px auto 0 auto;")}</td>`
    : "";
  const colspan = edito.image ? 2 : 1;
  const bodySignature =
    `<div>${edito.body}</div>` +
    `<p style="color:${C.orange};font-weight:800;margin:8px 0 0 0;">${edito.signature}</p>`;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.peach};border-radius:12px;margin-bottom:14px;">` +
    `<tr>` +
    sun +
    `<td valign="top" style="padding:16px 18px 16px 18px;font-size:15px;line-height:1.5;font-family:${FONT_BODY};color:${C.ink};">` +
    `<div style="color:${C.orange};font-weight:800;font-size:17px;margin-bottom:6px;">${edito.hello}</div>` +
    `<div class="edito-body-inline et-body">${bodySignature}</div>` +
    `</td>` +
    `</tr>` +
    `<tr class="edito-body-stack" style="display:none;"><td colspan="${colspan}" class="et-body" style="padding:0 18px 16px 18px;font-size:15px;line-height:1.5;font-family:${FONT_BODY};color:${C.ink};">${bodySignature}</td></tr>` +
    `</table>`
  );
}

/** Bas de page : info pratique (icône teal) + encart d'été (pêche), côte à côte. */
function bottomBlock(infoBox: InfoBox, summerBox: SummerBox): string {
  const sun = summerBox.image
    ? `<td width="64" valign="top" style="padding-top:4px;padding-right:14px;">${img(summerBox.image, 64, "border-radius:6px;")}</td>`
    : "";
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>` +
    // Info pratique
    `<td class="stack" width="277" valign="top">` +
    `<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.lav};border-radius:10px;"><tr><td style="padding:12px 14px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="46" valign="top" style="padding-right:10px;">` +
    `<table role="presentation" width="46" cellpadding="0" cellspacing="0" border="0" style="background:${C.tealDark};border-radius:50%;"><tr><td width="46" height="46" align="center" valign="middle" style="color:#ffffff;font-size:20px;">&#8505;</td></tr></table>` +
    `</td>` +
    `<td valign="top">` +
    `<h3 class="et-title" style="margin:0 0 5px 0;color:${C.teal};font-weight:800;font-size:16.5px;font-family:${FONT_BODY};">${infoBox.title}</h3>` +
    `<div class="et-body" style="font-size:14px;line-height:1.5;color:${C.ink};font-family:${FONT_BODY};">${infoBox.body}</div>` +
    `</td></tr></table>` +
    `</td></tr></table></td>` +
    `<td class="gut" width="12">&nbsp;</td>` +
    // Encart d'été
    `<td class="stack" valign="top">` +
    `<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.peach};border-radius:10px;"><tr><td style="padding:14px 20px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    sun +
    `<td valign="top">` +
    `<h3 class="et-title" style="color:${C.orange};font-weight:800;font-size:20px;margin:0 0 6px 0;line-height:1.15;font-family:${FONT_BODY};">${summerBox.title}</h3>` +
    `<div class="et-body" style="font-size:14.5px;line-height:1.5;color:${C.ink};font-family:${FONT_BODY};">${summerBox.body}</div>` +
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
    : "";
  return (
    `<tr><td style="padding-top:14px;">` +
    `<table role="presentation" class="foot-wrap" width="${SHEET_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="background:${C.orangeFoot};width:${SHEET_WIDTH}px;"><tr>` +
    `<td align="center" style="padding:22px 20px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td valign="middle" style="font-family:${FONT_HEAD};font-weight:800;color:#ffffff;font-size:16px;line-height:1.4;letter-spacing:.3px;text-align:right;padding-right:20px;">POUR L'ÉGALITÉ<br>POUR LA JUSTICE SOCIALE</td>` +
    logo +
    `<td valign="middle" style="font-family:${FONT_HEAD};font-weight:800;color:#ffffff;font-size:16px;line-height:1.4;letter-spacing:.3px;text-align:left;padding-left:20px;">LA CFDT ENGAGÉE<br>À VOS CÔTÉS</td>` +
    `</tr></table>` +
    `</td></tr></table>` +
    `</td></tr>`
  );
}

export function emailDocumentHTML(state: Newsletter): string {
  const content =
    `<tr><td style="padding:14px 32px 0 32px;">` +
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
    `.foot-wrap{width:100%!important;}` +
    `.hdr-cell{display:block!important;width:100%!important;text-align:center!important;padding-right:0!important;}` +
    `.edito-sun{width:72px!important;padding:12px 0 12px 10px!important;}` +
    `.edito-sun img{width:56px!important;}` +
    `.edito-body-inline{display:none!important;}` +
    `.edito-body-stack{display:table-row!important;}` +
    `.hdr-row2.pill{padding:5px 14px 6px 14px!important;font-size:14px!important;}` +
    `.hdr-row2.sun{width:52px!important;padding-right:6px!important;}` +
    `.hdr-row2.sun img{width:52px!important;}` +
    `.hdr-row2.mega{width:40px!important;padding-right:4px!important;}` +
    `.hdr-row2.mega img{width:40px!important;}` +
    `.mast-title{font-size:30px!important;line-height:1.25!important;text-align:center!important;}` +
    `.et-body{font-size:16px!important;line-height:1.55!important;}` +
    `.et-title{font-size:20px!important;}` +
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
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `newsletter-cfdt-email-${stamp}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
