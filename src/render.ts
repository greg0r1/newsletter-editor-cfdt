import type { Article, Newsletter } from './state';

function svgIcon(paths: string, w = 16, sw = 2): string {
  return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const ICON_INFO = svgIcon(
  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  18,
);
const ICON_PEOPLE = svgIcon(
  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  28,
);
const ICON_HAND = svgIcon(
  '<path d="M9 11l2 2 3-3 4 4"/><path d="M3 12l4-4 3 3"/><circle cx="4" cy="7" r="1.6"/><circle cx="20" cy="9" r="1.6"/>',
  28,
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
    `<div class="img-wrap cfdt-logo-wrap"><div class="cfdt-logo"><span>cfdt</span><b>:</b></div></div>` +
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
    `<div class="foot-logo">cfdt<b>:</b></div>` +
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
