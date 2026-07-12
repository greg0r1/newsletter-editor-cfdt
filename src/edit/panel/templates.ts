import { FORMAT_BUTTONS, ICONS, TEXT_COLORS } from './icons';

/**
 * Champs dont le miroir dans la feuille est synchronisé via `innerHTML`
 * (HTML autorisé). Doit rester cohérent avec la façon dont `Editor.serialize()`
 * relit ces champs : ceux lus par `this.html(...)` / `.innerHTML`. Les autres
 * champs sont synchronisés en `textContent`.
 */
export const HTML_FIELDS = new Set([
  'title',
  'mastOrg',
  'body',
  'editoBody',
  'infoBody',
  'summerBody',
  'highlight',
]);

/**
 * Section repliable du panneau. `id` doit être unique dans le panneau
 * courant (sert de clé de persistance de l'état ouvert/fermé, portée par
 * `collapsed` dans `EditPanel`). Repliée par défaut si `id` est dans
 * `collapsed`, sinon dépliée.
 */
function section(collapsed: Set<string>, id: string, title: string, iconSvg: string, bodyHtml: string): string {
  const isCollapsed = collapsed.has(id);
  return (
    `<section class="pf-section${isCollapsed ? ' pf-collapsed' : ''}" data-section="${id}">` +
    `<button type="button" class="pf-section-head" data-panel="toggleSection" data-section-id="${id}" aria-expanded="${!isCollapsed}">` +
    `<span class="pf-section-icon">${iconSvg}</span>` +
    `<span class="pf-section-title">${title}</span>` +
    `<span class="pf-section-chevron">${ICONS.chevron}</span>` +
    `</button>` +
    `<div class="pf-section-body">${bodyHtml}</div>` +
    `</section>`
  );
}

/** Bouton "Tout réduire / Tout déplier" en tête du corps du panneau. */
function sectionsToolbar(): string {
  return (
    `<div class="pf-sections-toolbar">` +
    `<button type="button" class="pf-toggle-all" data-panel="toggleAllSections">` +
    `<span class="pf-toggle-all-icon pf-toggle-all-icon-collapse">${ICONS.collapseAll}</span>` +
    `<span class="pf-toggle-all-icon pf-toggle-all-icon-expand">${ICONS.expandAll}</span>` +
    `<span class="pf-toggle-all-label"></span>` +
    `</button>` +
    `</div>`
  );
}

function header(title: string): string {
  return (
    `<div class="pf-header">` +
    `<span class="pf-title">${title}</span>` +
    `<span class="pf-dirty" hidden>Modifications non enregistrées</span>` +
    `<button type="button" class="tbtn primary pf-save" data-panel="save">${ICONS.save} Enregistrer</button>` +
    `<button type="button" class="pf-close" data-panel="close" title="Fermer">${ICONS.close}</button>` +
    `</div>`
  );
}

/**
 * Champ texte simple (une ligne, pas de formatage riche). `label` est
 * facultatif : dans une section repliable, le titre de la section suffit
 * déjà, un `pf-label` redondant n'est ajouté que si `label` est fourni
 * (ex. champs multiples dans une même section, cas inexistant aujourd'hui
 * mais gardé pour la réutilisabilité de la fonction).
 */
function textField(label: string, field: string, single = true): string {
  return (
    (label ? `<label class="pf-label">${label}</label>` : '') +
    `<div class="pf-field${single ? ' pf-single' : ''}" contenteditable="true" data-mirror="${field}"></div>`
  );
}

/** Champ riche (formatage WordPress-like : gras, listes, alignement, lien, couleur…). */
function richField(label: string, field: string): string {
  // Regroupe les boutons par `group`, séparés visuellement par un fin trait.
  let lastGroup = FORMAT_BUTTONS[0]?.group ?? 0;
  const buttons = FORMAT_BUTTONS.map((b) => {
    const sep = b.group !== lastGroup ? '<span class="pf-fmt-sep"></span>' : '';
    lastGroup = b.group;
    const attr = 'special' in b ? `data-special="${b.special}"` : `data-cmd="${b.cmd}"`;
    return `${sep}<button type="button" class="pf-fmt-btn" ${attr} title="${b.title}" aria-label="${b.title}">${b.label}</button>`;
  }).join('');

  const swatches = TEXT_COLORS.map(
    (c) =>
      `<button type="button" class="pf-swatch" data-color="${c.value}" title="${c.name}" aria-label="${c.name}" style="background:${c.value}"></button>`,
  ).join('');

  return (
    (label ? `<label class="pf-label">${label}</label>` : '') +
    `<div class="pf-fmt-bar">${buttons}` +
    `<div class="pf-color-pop" hidden>${swatches}</div>` +
    `</div>` +
    `<div class="pf-field pf-rich" contenteditable="true" data-mirror="${field}"></div>`
  );
}

function imageField(label: string, action: string, canRemove: boolean): string {
  const removeBtn = canRemove
    ? `<button type="button" class="tbtn danger" data-panel="removeImage">${ICONS.trash} Retirer</button>`
    : '';
  return (
    (label ? `<label class="pf-label">${label}</label>` : '') +
    `<div class="pf-image"><img class="pf-image-preview" data-panel-preview="${action}" alt=""></div>` +
    `<div class="pf-row">` +
    `<button type="button" class="tbtn" data-panel="image" data-image-action="${action}">${ICONS.image} Changer l'image</button>` +
    removeBtn +
    `</div>`
  );
}

export function renderArticle(collapsed: Set<string>, el: HTMLElement): string {
  const container = el.parentElement;
  const articles = container
    ? Array.from(container.querySelectorAll<HTMLElement>('.art'))
    : [el];
  const index = articles.indexOf(el);
  const total = articles.length;
  const hasImage = !!el.querySelector('.art-img');
  const hasHighlight = !!el.querySelector('.art-highlight');

  const positionOptions = articles
    .map((_, i) => `<option value="${i}"${i === index ? ' selected' : ''}>${i + 1}</option>`)
    .join('');

  const positionBody =
    `<div class="pf-row">` +
    `<label class="pf-inline">Placer en position` +
    ` <select class="pf-select" data-panel="moveTo">${positionOptions}</select> / ${total}</label>` +
    `</div>` +
    `<div class="pf-row">` +
    `<button type="button" class="tbtn" data-panel="moveUp"${index === 0 ? ' disabled' : ''}>${ICONS.up} Monter</button>` +
    `<button type="button" class="tbtn" data-panel="moveDown"${index === total - 1 ? ' disabled' : ''}>${ICONS.down} Descendre</button>` +
    `</div>`;

  const highlightBody =
    `<button type="button" class="tbtn" data-panel="toggleHighlight">${hasHighlight ? `${ICONS.minus} Retirer l’encart` : `${ICONS.plus} Ajouter un encart`}</button>` +
    (hasHighlight ? `<div class="pf-highlight-field">${richField('Texte de l’encart', 'highlight')}</div>` : '');

  return (
    header(`Article ${index + 1}`) +
    `<div class="pf-body">` +
    sectionsToolbar() +
    section(collapsed, 'article:title', 'Titre', ICONS.type, textField('', 'title')) +
    section(collapsed, 'article:image', hasImage ? 'Image' : 'Image (aucune)', ICONS.image, imageField('', 'article', hasImage)) +
    section(collapsed, 'article:body', 'Texte de l’article', ICONS.text, richField('', 'body')) +
    section(collapsed, 'article:highlight', 'Encart mis en avant', ICONS.star, highlightBody) +
    section(collapsed, 'article:position', 'Position dans la liste', ICONS.move, positionBody) +
    section(collapsed, 'article:delete', 'Supprimer', ICONS.trash, `<button type="button" class="tbtn danger pf-block" data-panel="delete">${ICONS.trash} Supprimer cet article</button>`) +
    `</div>`
  );
}

export function renderMast(collapsed: Set<string>): string {
  return (
    header('En-tête (bandeau)') +
    `<div class="pf-body">` +
    sectionsToolbar() +
    section(collapsed, 'mast:org', 'Organisation', ICONS.type, textField('', 'mastOrg', false)) +
    section(collapsed, 'mast:titleAccent', 'Titre — accent (orange)', ICONS.type, textField('', 'titleAccent')) +
    section(collapsed, 'mast:titleRest', 'Titre — suite', ICONS.type, textField('', 'titleRest')) +
    section(collapsed, 'mast:period', 'Période', ICONS.type, textField('', 'period')) +
    section(collapsed, 'mast:image', 'Image', ICONS.image, imageField('', 'mast', false)) +
    section(collapsed, 'mast:footerLogo', 'Logo (pied de page)', ICONS.image, imageField('', 'footerLogo', false)) +
    `</div>`
  );
}

export function renderEdito(collapsed: Set<string>): string {
  return (
    header('Édito') +
    `<div class="pf-body">` +
    sectionsToolbar() +
    section(collapsed, 'edito:hello', 'Accroche', ICONS.type, textField('', 'editoHello')) +
    section(collapsed, 'edito:body', 'Texte', ICONS.text, richField('', 'editoBody')) +
    section(collapsed, 'edito:sign', 'Signature', ICONS.type, textField('', 'editoSign')) +
    section(collapsed, 'edito:image', 'Image', ICONS.image, imageField('', 'edito', false)) +
    `</div>`
  );
}

export function renderInfo(collapsed: Set<string>): string {
  return (
    header('Informations pratiques') +
    `<div class="pf-body">` +
    section(collapsed, 'info:title', 'Titre', ICONS.type, textField('', 'infoTitle')) +
    section(collapsed, 'info:body', 'Texte', ICONS.text, richField('', 'infoBody')) +
    `</div>`
  );
}

export function renderSummer(collapsed: Set<string>): string {
  return (
    header('Encart de clôture') +
    `<div class="pf-body">` +
    sectionsToolbar() +
    section(collapsed, 'summer:title', 'Titre', ICONS.type, textField('', 'summerTitle')) +
    section(collapsed, 'summer:body', 'Texte', ICONS.text, richField('', 'summerBody')) +
    section(collapsed, 'summer:sign', 'Signature', ICONS.type, textField('', 'summerSign')) +
    section(collapsed, 'summer:image', 'Image', ICONS.image, imageField('', 'summer', false)) +
    `</div>`
  );
}
