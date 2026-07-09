import type { ImageTarget } from './edit';

/** Bloc actuellement édité dans le panneau. */
export type Selection =
  | { kind: 'article'; el: HTMLElement }
  | { kind: 'mast' }
  | { kind: 'edito' }
  | { kind: 'info' }
  | { kind: 'summer' };

/**
 * Champs dont le miroir dans la feuille est synchronisé via `innerHTML`
 * (HTML autorisé). Doit rester cohérent avec la façon dont `Editor.serialize()`
 * relit ces champs : ceux lus par `this.html(...)` / `.innerHTML`. Les autres
 * champs sont synchronisés en `textContent`.
 */
const HTML_FIELDS = new Set([
  'title',
  'mastOrg',
  'body',
  'editoBody',
  'infoBody',
  'summerBody',
  'highlight',
]);

/** Commandes du mini-éditeur riche (mappées sur document.execCommand). */
const FORMAT_BUTTONS: ReadonlyArray<{ cmd: string; label: string; title: string }> = [
  { cmd: 'bold', label: '<b>G</b>', title: 'Gras' },
  { cmd: 'italic', label: '<i>I</i>', title: 'Italique' },
  { cmd: 'underline', label: '<u>S</u>', title: 'Souligné' },
  { cmd: 'insertUnorderedList', label: '• Liste', title: 'Liste à puces' },
  { cmd: 'insertOrderedList', label: '1. Liste', title: 'Liste numérotée' },
  { cmd: 'removeFormat', label: '⨯ Format', title: 'Effacer le format' },
];

export interface PanelCallbacks {
  /** À appeler après toute mutation pour déclencher la sauvegarde debounced. */
  onChange: () => void;
  /** Déclenche le flux d'upload d'image (réutilise le pipeline de l'Editor). */
  onRequestImage: (kind: ImageTarget, articleEl: HTMLElement | null) => void;
  /** Retire l'image d'un article (ou vide l'image d'un bloc). */
  onRemoveArticleImage: (articleEl: HTMLElement) => void;
  /** Déplace un article d'un cran. */
  onMoveArticle: (articleEl: HTMLElement, dir: 'up' | 'down') => void;
  /** Déplace un article à une position absolue (index 0-based). */
  onMoveArticleTo: (articleEl: HTMLElement, index: number) => void;
  /** Ajoute/retire l'encart mis en avant d'un article, renvoie l'élément si créé. */
  onToggleHighlight: (articleEl: HTMLElement) => HTMLElement | null;
  /** Supprime un article après confirmation ; renvoie true si supprimé. */
  onDeleteArticle: (articleEl: HTMLElement) => boolean;
}

/**
 * Panneau latéral d'édition contextuel. Il héberge les vrais champs
 * `contenteditable` (source de vérité pendant la frappe) et recopie en one-way
 * leur contenu vers le miroir en lecture seule de la feuille A4. Il ne parle
 * jamais au réseau : toutes les actions structurelles et l'upload d'image sont
 * délégués à l'Editor via `PanelCallbacks`.
 */
export class EditPanel {
  private aside: HTMLElement;
  private root: HTMLElement;
  private cb: PanelCallbacks;
  private appContent: HTMLElement;
  private selection: Selection | null = null;

  constructor(opts: {
    aside: HTMLElement;
    root: HTMLElement;
    appContent: HTMLElement;
    callbacks: PanelCallbacks;
  }) {
    this.aside = opts.aside;
    this.root = opts.root;
    this.appContent = opts.appContent;
    this.cb = opts.callbacks;
    this.bindEvents();
  }

  // ---------------------------------------------------------------- ouverture

  open(sel: Selection): void {
    this.render(sel);
    // Focus sur le premier champ éditable du panneau : légitime à l'ouverture
    // (nouvelle sélection), pas lors d'un simple refresh() sur la sélection
    // déjà ouverte (voir refresh(), qui n'appelle pas ce focus).
    this.aside.querySelector<HTMLElement>('.pf-field')?.focus();
  }

  close(): void {
    this.selection = null;
    this.clearSelectedMarker();
    this.aside.innerHTML = '';
    this.appContent.classList.remove('panel-open');
  }

  private render(sel: Selection): void {
    this.clearSelectedMarker();
    this.selection = sel;
    this.markSelected(sel);
    this.aside.innerHTML = this.renderFor(sel);
    this.appContent.classList.add('panel-open');
    this.wireFields();
  }

  /**
   * Resynchronise le panneau après une mutation structurelle de la feuille
   * (déplacement/suppression d'article, changement d'image, toggle encart).
   * Contrairement à open(), ne vole pas le focus : l'utilisateur reste
   * généralement sur le bouton qu'il vient de cliquer. Si le bloc édité
   * n'existe plus, ferme le panneau.
   */
  refresh(): void {
    if (!this.selection) return;
    if (this.selection.kind === 'article' && !this.selection.el.isConnected) {
      this.close();
      return;
    }
    this.render(this.selection);
  }

  // ------------------------------------------------------------- marqueur DOM

  private clearSelectedMarker(): void {
    this.root.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
  }

  private markSelected(sel: Selection): void {
    const el = sel.kind === 'article' ? sel.el : this.blockEl(sel.kind);
    el?.classList.add('selected');
  }

  private blockEl(kind: 'mast' | 'edito' | 'info' | 'summer'): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(`[data-block="${kind}"]`);
  }

  // ------------------------------------------------------------------- rendu

  private renderFor(sel: Selection): string {
    switch (sel.kind) {
      case 'article':
        return this.renderArticle(sel.el);
      case 'mast':
        return this.renderMast();
      case 'edito':
        return this.renderEdito();
      case 'info':
        return this.renderInfo();
      case 'summer':
        return this.renderSummer();
    }
  }

  private header(title: string): string {
    return (
      `<div class="pf-header">` +
      `<span class="pf-title">${title}</span>` +
      `<button type="button" class="pf-close" data-panel="close" title="Fermer">✕</button>` +
      `</div>`
    );
  }

  /** Champ texte simple (une ligne, pas de formatage riche). */
  private textField(label: string, field: string, single = true): string {
    return (
      `<label class="pf-label">${label}</label>` +
      `<div class="pf-field${single ? ' pf-single' : ''}" contenteditable="true" data-mirror="${field}"></div>`
    );
  }

  /** Champ riche (formatage WordPress-like : gras, listes…). */
  private richField(label: string, field: string): string {
    const buttons = FORMAT_BUTTONS.map(
      (b) =>
        `<button type="button" class="pf-fmt-btn" data-cmd="${b.cmd}" title="${b.title}">${b.label}</button>`,
    ).join('');
    return (
      `<label class="pf-label">${label}</label>` +
      `<div class="pf-fmt-bar">${buttons}</div>` +
      `<div class="pf-field pf-rich" contenteditable="true" data-mirror="${field}"></div>`
    );
  }

  private imageField(label: string, action: string, canRemove: boolean): string {
    const removeBtn = canRemove
      ? `<button type="button" class="tbtn danger" data-panel="removeImage">Retirer</button>`
      : '';
    return (
      `<label class="pf-label">${label}</label>` +
      `<div class="pf-image"><img class="pf-image-preview" data-panel-preview="${action}" alt=""></div>` +
      `<div class="pf-row">` +
      `<button type="button" class="tbtn primary" data-panel="image" data-image-action="${action}">🖼 Changer l'image</button>` +
      removeBtn +
      `</div>`
    );
  }

  private renderArticle(el: HTMLElement): string {
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

    return (
      this.header(`Article ${index + 1}`) +
      `<div class="pf-body">` +
      `<section class="pf-section">` +
      this.textField('Titre', 'title') +
      `</section>` +
      `<section class="pf-section">` +
      this.imageField(hasImage ? 'Image' : 'Image (aucune)', 'article', hasImage) +
      `</section>` +
      `<section class="pf-section">` +
      this.richField('Texte de l’article', 'body') +
      `</section>` +
      `<section class="pf-section">` +
      `<label class="pf-label">Encart mis en avant</label>` +
      `<button type="button" class="tbtn" data-panel="toggleHighlight">${hasHighlight ? '− Retirer l’encart' : '+ Ajouter un encart'}</button>` +
      (hasHighlight ? `<div class="pf-highlight-field">${this.richField('Texte de l’encart', 'highlight')}</div>` : '') +
      `</section>` +
      `<section class="pf-section">` +
      `<label class="pf-label">Position dans la liste</label>` +
      `<div class="pf-row">` +
      `<label class="pf-inline">Placer en position` +
      ` <select class="pf-select" data-panel="moveTo">${positionOptions}</select> / ${total}</label>` +
      `</div>` +
      `<div class="pf-row">` +
      `<button type="button" class="tbtn" data-panel="moveUp"${index === 0 ? ' disabled' : ''}>↑ Monter</button>` +
      `<button type="button" class="tbtn" data-panel="moveDown"${index === total - 1 ? ' disabled' : ''}>↓ Descendre</button>` +
      `</div>` +
      `</section>` +
      `<section class="pf-section">` +
      `<button type="button" class="tbtn danger pf-block" data-panel="delete">🗑 Supprimer cet article</button>` +
      `</section>` +
      `</div>`
    );
  }

  private renderMast(): string {
    return (
      this.header('En-tête (bandeau)') +
      `<div class="pf-body">` +
      `<section class="pf-section">${this.textField('Organisation', 'mastOrg', false)}</section>` +
      `<section class="pf-section">${this.textField('Titre — accent (orange)', 'titleAccent')}</section>` +
      `<section class="pf-section">${this.textField('Titre — suite', 'titleRest')}</section>` +
      `<section class="pf-section">${this.textField('Période', 'period')}</section>` +
      `<section class="pf-section">${this.imageField('Image', 'mast', false)}</section>` +
      `</div>`
    );
  }

  private renderEdito(): string {
    return (
      this.header('Édito') +
      `<div class="pf-body">` +
      `<section class="pf-section">${this.textField('Accroche', 'editoHello')}</section>` +
      `<section class="pf-section">${this.richField('Texte', 'editoBody')}</section>` +
      `<section class="pf-section">${this.textField('Signature', 'editoSign')}</section>` +
      `<section class="pf-section">${this.imageField('Image', 'edito', false)}</section>` +
      `</div>`
    );
  }

  private renderInfo(): string {
    return (
      this.header('Informations pratiques') +
      `<div class="pf-body">` +
      `<section class="pf-section">${this.textField('Titre', 'infoTitle')}</section>` +
      `<section class="pf-section">${this.richField('Texte', 'infoBody')}</section>` +
      `</div>`
    );
  }

  private renderSummer(): string {
    return (
      this.header('Encart de clôture') +
      `<div class="pf-body">` +
      `<section class="pf-section">${this.textField('Titre', 'summerTitle')}</section>` +
      `<section class="pf-section">${this.richField('Texte', 'summerBody')}</section>` +
      `<section class="pf-section">${this.textField('Signature', 'summerSign')}</section>` +
      `<section class="pf-section">${this.imageField('Image', 'summer', false)}</section>` +
      `</div>`
    );
  }

  // ------------------------------------------------ liaison champs ↔ miroirs

  /** Élément miroir (dans la feuille) correspondant à un champ du panneau. */
  private mirrorFor(field: string): HTMLElement | null {
    if (this.selection?.kind === 'article') {
      return this.selection.el.querySelector<HTMLElement>(`[data-field="${field}"]`);
    }
    return this.root.querySelector<HTMLElement>(`[data-field="${field}"]`);
  }

  /** Renseigne chaque champ du panneau depuis son miroir et câble la sync. */
  private wireFields(): void {
    this.aside.querySelectorAll<HTMLElement>('[data-mirror]').forEach((field) => {
      const name = field.dataset.mirror!;
      const mirror = this.mirrorFor(name);
      if (mirror) {
        if (HTML_FIELDS.has(name)) field.innerHTML = mirror.innerHTML;
        else field.textContent = mirror.textContent;
      }
    });

    // Renseigne les aperçus d'image.
    this.aside.querySelectorAll<HTMLImageElement>('[data-panel-preview]').forEach((preview) => {
      const src = this.imageSrcFor(preview.dataset.panelPreview!);
      if (src) preview.src = src;
      else preview.closest('.pf-image')?.classList.add('pf-image-empty');
    });
  }

  private imageSrcFor(action: string): string | null {
    if (action === 'article' && this.selection?.kind === 'article') {
      return this.selection.el.querySelector<HTMLImageElement>('.art-img')?.src ?? null;
    }
    if (action === 'mast') return this.root.querySelector<HTMLImageElement>('.mast-right img')?.src ?? null;
    if (action === 'edito') return this.root.querySelector<HTMLImageElement>('.edito-sun img')?.src ?? null;
    if (action === 'summer') return this.root.querySelector<HTMLImageElement>('.box-summer .sun-mini')?.src ?? null;
    return null;
  }

  private syncField(field: HTMLElement): void {
    const name = field.dataset.mirror;
    if (!name) return;
    const mirror = this.mirrorFor(name);
    if (!mirror) return;
    if (HTML_FIELDS.has(name)) mirror.innerHTML = field.innerHTML;
    else mirror.textContent = field.textContent;
    this.cb.onChange();
  }

  // ---------------------------------------------------------------- events

  private articleEl(): HTMLElement | null {
    return this.selection?.kind === 'article' ? this.selection.el : null;
  }

  private bindEvents(): void {
    // Sync one-way des champs du panneau vers la feuille.
    this.aside.addEventListener('input', (e) => {
      const field = (e.target as HTMLElement).closest<HTMLElement>('[data-mirror]');
      if (field) this.syncField(field);
    });

    // Boutons de formatage : agissent sur le champ riche courant.
    this.aside.addEventListener('mousedown', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.pf-fmt-btn');
      if (!btn) return;
      e.preventDefault(); // garde le focus/la sélection dans le champ
      document.execCommand(btn.dataset.cmd ?? '', false);
      const field = btn.parentElement?.nextElementSibling as HTMLElement | null;
      if (field?.matches('[data-mirror]')) this.syncField(field);
    });

    // Actions structurelles et images.
    this.aside.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-panel]');
      if (!btn) return;
      const action = btn.dataset.panel;
      const art = this.articleEl();

      switch (action) {
        case 'close':
          this.close();
          break;
        case 'moveUp':
          if (art) this.cb.onMoveArticle(art, 'up');
          break;
        case 'moveDown':
          if (art) this.cb.onMoveArticle(art, 'down');
          break;
        case 'delete':
          if (art && this.cb.onDeleteArticle(art)) this.close();
          break;
        case 'toggleHighlight':
          if (art) {
            this.cb.onToggleHighlight(art);
            this.refresh();
          }
          break;
        case 'image': {
          const kind = btn.dataset.imageAction as ImageTarget;
          this.cb.onRequestImage(kind, kind === 'article' ? art : null);
          break;
        }
        case 'removeImage':
          if (art) {
            this.cb.onRemoveArticleImage(art);
            this.refresh();
          }
          break;
      }
    });

    // Menu déroulant de position.
    this.aside.addEventListener('change', (e) => {
      const select = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-panel="moveTo"]');
      if (!select) return;
      const art = this.articleEl();
      if (art) this.cb.onMoveArticleTo(art, Number(select.value));
    });
  }
}

const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 900;
const PANEL_WIDTH_STORAGE_KEY = 'editPanelWidth';

/**
 * Câble la poignée de redimensionnement horizontal du panneau (drag souris).
 * La largeur est bornée entre PANEL_MIN_WIDTH et PANEL_MAX_WIDTH, et persistée
 * en sessionStorage pour survivre à un rechargement de page.
 */
export function bindPanelResize(handle: HTMLElement, aside: HTMLElement): void {
  const stored = Number(sessionStorage.getItem(PANEL_WIDTH_STORAGE_KEY));
  if (stored) aside.style.setProperty('--panel-width', `${clampWidth(stored)}px`);

  function clampWidth(w: number): number {
    const max = Math.min(PANEL_MAX_WIDTH, window.innerWidth * 0.7);
    return Math.max(PANEL_MIN_WIDTH, Math.min(w, max));
  }

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = aside.getBoundingClientRect().width;
    document.body.classList.add('panel-resizing');

    function onMove(ev: MouseEvent): void {
      const width = clampWidth(startWidth - (ev.clientX - startX));
      aside.style.setProperty('--panel-width', `${width}px`);
    }
    function onUp(): void {
      document.body.classList.remove('panel-resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const width = aside.getBoundingClientRect().width;
      if (width) sessionStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(Math.round(width)));
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}
