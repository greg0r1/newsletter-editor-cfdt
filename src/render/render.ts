import type { Article, Newsletter } from '../state/state';

function svgIcon(paths: string, w = 16, sw = 2): string {
  return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

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
const ICON_MEGAPHONE = '<img class="mast-megaphone" src="/mast-megaphone.png" alt="" aria-hidden="true">';

const ICON_SPARKLES =
  '<svg class="mast-sparkles" width="30" height="26" viewBox="0 0 30 26" fill="var(--orange)" aria-hidden="true">' +
  '<rect x="1" y="10" width="5" height="14" rx="2.5" transform="rotate(-28 3.5 17)"/>' +
  '<rect x="12.5" y="6" width="5" height="16" rx="2.5"/>' +
  '<rect x="24" y="10" width="5" height="14" rx="2.5" transform="rotate(28 26.5 17)"/>' +
  '</svg>';

export function articleHTML(a: Article): string {
  const imgBlock = a.imageUrl
    ? `<div class="img-wrap"><img class="art-img" src="${a.imageUrl}"></div>`
    : '';

  const highlight =
    a.highlight != null
      ? `<div class="art-highlight" data-field="highlight">${a.highlight}</div>`
      : '';

  const halfClass = a.layout === 'half' ? ' art-half' : '';

  return (
    `<article class="art${halfClass} selectable" data-id="${a.id}" data-layout="${a.layout}">` +
    `<div class="art-head"><span class="num"></span><h3 data-field="title">${a.title}</h3></div>` +
    imgBlock +
    `<div class="art-body" data-field="body">${a.body}</div>` +
    highlight +
    `</article>`
  );
}

export function fullHTML(state: Newsletter): string {
  const articlesHtml = state.articles.map(articleHTML).join('');

  return (
    `<header class="mast selectable" data-block="mast">` +
    `<div class="mast-row mast-row-top">` +
    `<div class="img-wrap cfdt-logo-wrap"><img class="cfdt-logo" src="/cfdt-logo.svg" alt="CFDT"></div>` +
    `<div class="mast-title" data-title-mode="${state.mast.titleMode}">` +
    (state.mast.titleMode === 'image'
      ? `<img class="mast-title-img" src="${state.mast.titleImageUrl ?? ''}" alt="">`
      : `<span data-field="mastTitle">${state.mast.title}</span>`) +
    `</div>` +
    `</div>` +
    `<div class="mast-row mast-row-bottom">` +
    `<div class="img-wrap mast-sun-wrap"><img class="mast-sun" src="${state.mast.image}"></div>` +
    `<div class="mast-pill-row">` +
    `${ICON_MEGAPHONE}` +
    `<span class="mast-pill" data-field="period">${state.mast.period}</span>` +
    `${ICON_SPARKLES}` +
    `</div>` +
    `</div>` +
    `</header>` +
    `<section class="edito selectable" data-block="edito">` +
    `<div class="edito-sun img-wrap"><img src="${state.edito.image}"></div>` +
    `<div class="edito-txt">` +
    `<span class="card-emoji">💬</span>` +
    `<span class="hello" data-field="editoHello">${state.edito.hello}</span>` +
    `<div class="edito-body" data-field="editoBody">${state.edito.body}</div>` +
    `<span class="sign" data-field="editoSign">${state.edito.signature}</span>` +
    `</div>` +
    `</section>` +
    `<div class="articles" id="articlesContainer">` +
    articlesHtml +
    `</div>` +
    `<div class="tail">` +
    `<section class="bottom">` +
    `<div class="box box-info selectable" data-block="info">` +
    `<div class="box-head"><span class="bh-ic">ℹ️</span><h4 data-field="infoTitle">${state.infoBox.title}</h4></div>` +
    `<div class="box-body" data-field="infoBody">${state.infoBox.body}</div>` +
    `</div>` +
    `<div class="box box-summer selectable" data-block="summer">` +
    `<div class="box-head img-wrap"><span class="bh-ic">☀️</span><img class="sun-mini" src="${state.summerBox.image}">` +
    `<h4 data-field="summerTitle">${state.summerBox.title}</h4></div>` +
    `<div class="box-body" data-field="summerBody">${state.summerBox.body}</div>` +
    `<span class="sign" data-field="summerSign">${state.summerBox.signature}</span>` +
    `</div>` +
    `</section>` +
    `<footer class="foot">` +
    `<div class="foot-l">${ICON_PEOPLE}<span>POUR L'ÉGALITÉ<br>POUR LA JUSTICE SOCIALE</span></div>` +
    `<div class="foot-logo"><img src="${state.mast.footerLogoUrl || '/cfdt-logo-footer.svg'}" alt="CFDT"></div>` +
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
