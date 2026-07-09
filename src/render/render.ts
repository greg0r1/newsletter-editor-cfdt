import type { Article, Newsletter } from '../state/state';

function svgIcon(paths: string, w = 16, sw = 2): string {
  return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const ICON_INFO = svgIcon(
  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  18,
);
const ICON_PEOPLE =
  '<svg width="52" height="36" viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" fill="#ffffff">' +
  '<circle cx="16" cy="10" r="6"/><path d="M4 34 C4 24 9 21 16 21 C23 21 28 24 28 34 Z"/>' +
  '<circle cx="34" cy="8" r="5"/><path d="M26 30 C27 21 30 18.5 34 18.5 C39.5 18.5 43.5 21.5 43.5 30 Z" opacity=".92"/>' +
  '<circle cx="48" cy="11" r="5.4"/><path d="M38.5 34 C38.5 25.5 43 22.5 48 22.5 C53.5 22.5 58 25.5 58 34 Z" opacity=".92"/>' +
  '</svg>';
const ICON_HAND = svgIcon(
  '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  28,
  1.9,
);

export function articleHTML(a: Article): string {
  const imgBlock = a.imageUrl
    ? `<div class="img-wrap"><img class="art-img" src="${a.imageUrl}">` +
      `<button class="mini-btn img-btn no-print" data-action="changeImage" title="Changer l'image">🖼 Changer</button></div>`
    : `<div class="no-img-placeholder no-print" data-action="changeImage">🖼 Ajouter une image</div>`;

  const highlight =
    a.highlight != null
      ? `<div class="art-highlight editable" contenteditable="true" data-field="highlight">${a.highlight}</div>`
      : '';

  return (
    `<article class="art" data-id="${a.id}">` +
    `<div class="art-toolbar no-print">` +
    `<button class="mini-btn" data-action="moveUp" title="Monter">↑</button>` +
    `<button class="mini-btn" data-action="moveDown" title="Descendre">↓</button>` +
    `<button class="mini-btn" data-action="toggleHighlight" title="Encart mis en avant">${a.highlight != null ? '− encart' : '+ encart'}</button>` +
    `<button class="mini-btn del" data-action="deleteArticle" title="Supprimer">🗑</button>` +
    `</div>` +
    `<div class="art-head"><span class="num"></span><h3 class="editable" contenteditable="true" data-field="title">${a.title}</h3></div>` +
    imgBlock +
    `<div class="art-body editable" contenteditable="true" data-field="body">${a.body}</div>` +
    highlight +
    `</article>`
  );
}

export function fullHTML(state: Newsletter): string {
  const articlesHtml = state.articles.map(articleHTML).join('');

  return (
    `<header class="mast">` +
    `<div class="mast-left">` +
    `<div class="img-wrap cfdt-logo-wrap"><img class="cfdt-logo" src="/cfdt-logo.svg" alt="CFDT"></div>` +
    `<div class="mast-org editable" contenteditable="true" data-field="mastOrg">${state.mast.orgLines}</div>` +
    `</div>` +
    `<div class="mast-center">` +
    `<div class="mast-title">` +
    `<span class="o editable" contenteditable="true" data-field="titleAccent">${state.mast.titleAccent}</span>` +
    ` <span class="editable" contenteditable="true" data-field="titleRest">${state.mast.titleRest}</span>` +
    `</div>` +
    `<span class="mast-pill editable" contenteditable="true" data-field="period">${state.mast.period}</span>` +
    `</div>` +
    `<div class="mast-right img-wrap"><img src="${state.mast.image}">` +
    `<button class="mini-btn img-btn no-print" data-action="changeMastImage" title="Changer l'image">🖼 Changer</button></div>` +
    `</header>` +
    `<section class="edito">` +
    `<div class="edito-sun img-wrap"><img src="${state.edito.image}">` +
    `<button class="mini-btn img-btn no-print" data-action="changeEditoImage" title="Changer l'image">🖼 Changer</button></div>` +
    `<div class="edito-txt">` +
    `<span class="hello editable" contenteditable="true" data-field="editoHello">${state.edito.hello}</span>` +
    `<div class="edito-body editable" contenteditable="true" data-field="editoBody">${state.edito.body}</div>` +
    `<span class="sign editable" contenteditable="true" data-field="editoSign">${state.edito.signature}</span>` +
    `</div>` +
    `</section>` +
    `<div class="articles" id="articlesContainer">` +
    articlesHtml +
    `<div class="add-art-btn no-print" data-action="addArticle">＋ Ajouter un article</div>` +
    `</div>` +
    `<div class="tail">` +
    `<section class="bottom">` +
    `<div class="box box-info">` +
    `<div class="box-head"><span class="bh-ic">${ICON_INFO}</span><h4 class="editable" contenteditable="true" data-field="infoTitle">${state.infoBox.title}</h4></div>` +
    `<div class="box-body editable" contenteditable="true" data-field="infoBody">${state.infoBox.body}</div>` +
    `</div>` +
    `<div class="box box-summer">` +
    `<div class="box-head img-wrap"><img class="sun-mini" src="${state.summerBox.image}">` +
    `<button class="mini-btn img-btn no-print" data-action="changeSummerImage" title="Changer l'image">🖼</button>` +
    `<h4 class="editable" contenteditable="true" data-field="summerTitle">${state.summerBox.title}</h4></div>` +
    `<div class="box-body editable" contenteditable="true" data-field="summerBody">${state.summerBox.body}</div>` +
    `<span class="sign editable" contenteditable="true" data-field="summerSign">${state.summerBox.signature}</span>` +
    `</div>` +
    `</section>` +
    `<footer class="foot">` +
    `<div class="foot-l">${ICON_PEOPLE}<span>POUR L'ÉGALITÉ<br>POUR LA JUSTICE SOCIALE</span></div>` +
    `<div class="foot-logo"><img src="/cfdt-logo-footer.svg" alt="CFDT"></div>` +
    `<div class="foot-r"><span>LA CFDT ENGAGÉE<br>À VOS CÔTÉS</span>${ICON_HAND}</div>` +
    `</footer>` +
    `</div>`
  );
}

export function renderAll(root: HTMLElement, state: Newsletter): void {
  root.innerHTML = fullHTML(state);
  renumber(root);
}

export function renumber(root: HTMLElement): void {
  const nums = root.querySelectorAll('#articlesContainer .art .num');
  nums.forEach((el, i) => {
    el.textContent = String(i + 1);
  });
}
