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

/** Icône SVG inline (tracés style Lucide, colorés via currentColor). */
function icon(paths: string): string {
  return (
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

/** Icônes de la barre de formatage riche (mêmes conventions que `icon`). */
function ICON_B(kind: string): string {
  const p: Record<string, string> = {
    bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/>',
    italic: '<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>',
    underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/>',
    bullet: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
    ordered: '<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6.5 15.5A1 1 0 1 0 5 17c.7.4-1 1-1.5 1.5H6.5"/>',
    alignLeft: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>',
    alignCenter: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    color: '<path d="M12 3 4 21h3l1.5-4h7L18 21h3z"/><path d="M9.2 14h5.6"/>',
    clear: '<path d="M4 7h16"/><path d="m6 7 1 13h10l1-13"/><path d="m9 4 6 0"/><line x1="9" y1="11" x2="15" y2="17"/><line x1="15" y1="11" x2="9" y2="17"/>',
  };
  return icon(p[kind] ?? '');
}

const ICONS = {
  close: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
  save: icon('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>'),
  image: icon(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>' +
      '<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  ),
  trash: icon(
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  ),
  up: icon('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
  down: icon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  minus: icon('<path d="M5 12h14"/>'),
};

/**
 * Boutons du mini-éditeur riche. La plupart sont de simples `document.execCommand`
 * (`cmd`), regroupés visuellement par `group`. Deux ont un comportement spécial
 * (`special`) traité à part : insertion de lien (prompt) et couleur (palette).
 */
type FormatButton =
  | { cmd: string; label: string; title: string; group: number }
  | { special: 'link' | 'color'; label: string; title: string; group: number };

const FORMAT_BUTTONS: ReadonlyArray<FormatButton> = [
  { cmd: 'bold', label: ICON_B('bold'), title: 'Gras', group: 0 },
  { cmd: 'italic', label: ICON_B('italic'), title: 'Italique', group: 0 },
  { cmd: 'underline', label: ICON_B('underline'), title: 'Souligné', group: 0 },
  { cmd: 'insertUnorderedList', label: ICON_B('bullet'), title: 'Liste à puces', group: 1 },
  { cmd: 'insertOrderedList', label: ICON_B('ordered'), title: 'Liste numérotée', group: 1 },
  { cmd: 'justifyLeft', label: ICON_B('alignLeft'), title: 'Aligner à gauche', group: 2 },
  { cmd: 'justifyCenter', label: ICON_B('alignCenter'), title: 'Centrer', group: 2 },
  { special: 'link', label: ICON_B('link'), title: 'Insérer un lien', group: 3 },
  { special: 'color', label: ICON_B('color'), title: 'Couleur du texte', group: 3 },
  { cmd: 'removeFormat', label: ICON_B('clear'), title: 'Effacer le format', group: 4 },
];

/** Palette de couleurs proposée pour le texte (identité + neutres). */
const TEXT_COLORS: ReadonlyArray<{ value: string; name: string }> = [
  { value: '#2f3640', name: 'Encre' },
  { value: '#4a5666', name: 'Gris' },
  { value: '#0b2c54', name: 'Bleu marine' },
  { value: '#e84e10', name: 'Orange CFDT' },
  { value: '#1f8a5b', name: 'Vert' },
  { value: '#c0392b', name: 'Rouge' },
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
  private dirty = false;

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
    this.dirty = false;
    this.clearSelectedMarker();
    this.aside.innerHTML = '';
    this.appContent.classList.remove('panel-open');
  }

  private render(sel: Selection): void {
    this.clearSelectedMarker();
    this.selection = sel;
    this.dirty = false;
    this.markSelected(sel);
    this.aside.innerHTML = this.renderFor(sel);
    this.appContent.classList.add('panel-open');
    this.wireFields();
  }

  /**
   * Resynchronise le panneau après une mutation structurelle de la feuille
   * (déplacement/suppression d'article, changement d'image, toggle encart).
   * Ces actions passent déjà par le bouton "Enregistrer" (voir bindEvents),
   * donc aucune modif de champ texte n'est en jeu ici. Contrairement à
   * open(), ne vole pas le focus : l'utilisateur reste généralement sur le
   * bouton qu'il vient de cliquer. Si le bloc édité n'existe plus, ferme le
   * panneau.
   */
  refresh(): void {
    if (!this.selection) return;
    if (this.selection.kind === 'article' && !this.selection.el.isConnected) {
      this.selection = null;
      this.dirty = false;
      this.clearSelectedMarker();
      this.aside.innerHTML = '';
      this.appContent.classList.remove('panel-open');
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
      `<span class="pf-dirty" hidden>Modifications non enregistrées</span>` +
      `<button type="button" class="tbtn primary pf-save" data-panel="save">${ICONS.save} Enregistrer</button>` +
      `<button type="button" class="pf-close" data-panel="close" title="Fermer">${ICONS.close}</button>` +
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

  /** Champ riche (formatage WordPress-like : gras, listes, alignement, lien, couleur…). */
  private richField(label: string, field: string): string {
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
      `<label class="pf-label">${label}</label>` +
      `<div class="pf-fmt-bar">${buttons}` +
      `<div class="pf-color-pop" hidden>${swatches}</div>` +
      `</div>` +
      `<div class="pf-field pf-rich" contenteditable="true" data-mirror="${field}"></div>`
    );
  }

  private imageField(label: string, action: string, canRemove: boolean): string {
    const removeBtn = canRemove
      ? `<button type="button" class="tbtn danger" data-panel="removeImage">${ICONS.trash} Retirer</button>`
      : '';
    return (
      `<label class="pf-label">${label}</label>` +
      `<div class="pf-image"><img class="pf-image-preview" data-panel-preview="${action}" alt=""></div>` +
      `<div class="pf-row">` +
      `<button type="button" class="tbtn primary" data-panel="image" data-image-action="${action}">${ICONS.image} Changer l'image</button>` +
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
      `<button type="button" class="tbtn" data-panel="toggleHighlight">${hasHighlight ? `${ICONS.minus} Retirer l’encart` : `${ICONS.plus} Ajouter un encart`}</button>` +
      (hasHighlight ? `<div class="pf-highlight-field">${this.richField('Texte de l’encart', 'highlight')}</div>` : '') +
      `</section>` +
      `<section class="pf-section">` +
      `<label class="pf-label">Position dans la liste</label>` +
      `<div class="pf-row">` +
      `<label class="pf-inline">Placer en position` +
      ` <select class="pf-select" data-panel="moveTo">${positionOptions}</select> / ${total}</label>` +
      `</div>` +
      `<div class="pf-row">` +
      `<button type="button" class="tbtn" data-panel="moveUp"${index === 0 ? ' disabled' : ''}>${ICONS.up} Monter</button>` +
      `<button type="button" class="tbtn" data-panel="moveDown"${index === total - 1 ? ' disabled' : ''}>${ICONS.down} Descendre</button>` +
      `</div>` +
      `</section>` +
      `<section class="pf-section">` +
      `<button type="button" class="tbtn danger pf-block" data-panel="delete">${ICONS.trash} Supprimer cet article</button>` +
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

  /** Recopie un champ du panneau vers son miroir dans la feuille (sans sauvegarder). */
  private syncField(field: HTMLElement): void {
    const name = field.dataset.mirror;
    if (!name) return;
    const mirror = this.mirrorFor(name);
    if (!mirror) return;
    if (HTML_FIELDS.has(name)) mirror.innerHTML = field.innerHTML;
    else mirror.textContent = field.textContent;
  }

  private setDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.aside.querySelector<HTMLElement>('.pf-dirty')?.removeAttribute('hidden');
  }

  /** Applique tous les champs du panneau à la feuille puis déclenche la sauvegarde. */
  private saveAll(): void {
    this.aside.querySelectorAll<HTMLElement>('[data-mirror]').forEach((field) => this.syncField(field));
    this.dirty = false;
    this.aside.querySelector<HTMLElement>('.pf-dirty')?.setAttribute('hidden', '');
    this.cb.onChange();
  }

  // ---------------------------------------------------------------- events

  private articleEl(): HTMLElement | null {
    return this.selection?.kind === 'article' ? this.selection.el : null;
  }

  /**
   * Exécute une commande de formatage sur le champ riche piloté par la barre
   * qui contient `origin`, puis resynchronise ce champ vers la feuille. Le champ
   * est le premier `[data-mirror]` qui suit la barre — robuste même si un
   * élément (popover couleur) s'intercale entre la barre et le champ.
   */
  private applyFormat(origin: HTMLElement, cmd: string, value?: string): void {
    const bar = origin.closest('.pf-fmt-bar');
    let node = bar?.nextElementSibling as HTMLElement | null;
    while (node && !node.matches('[data-mirror]')) node = node.nextElementSibling as HTMLElement | null;
    if (!node) return;
    node.focus();
    document.execCommand(cmd, false, value);
    this.setDirty();
  }

  private toggleColorPopover(btn: HTMLElement): void {
    const pop = btn.closest('.pf-fmt-bar')?.querySelector<HTMLElement>('.pf-color-pop');
    if (!pop) return;
    const wasOpen = !pop.hidden;
    this.closeColorPopovers();
    pop.hidden = wasOpen;
  }

  private closeColorPopovers(): void {
    this.aside.querySelectorAll<HTMLElement>('.pf-color-pop').forEach((p) => (p.hidden = true));
  }

  private bindEvents(): void {
    // La frappe ne touche que le champ du panneau : la feuille et le serveur
    // ne sont mis à jour qu'au clic sur "Enregistrer" (voir saveAll()).
    this.aside.addEventListener('input', (e) => {
      const field = (e.target as HTMLElement).closest<HTMLElement>('[data-mirror]');
      if (field) this.setDirty();
    });

    // Boutons de formatage : agissent sur le champ riche courant.
    this.aside.addEventListener('mousedown', (e) => {
      const swatch = (e.target as HTMLElement).closest<HTMLElement>('.pf-swatch');
      if (swatch) {
        e.preventDefault(); // garde la sélection dans le champ
        this.applyFormat(swatch, 'foreColor', swatch.dataset.color ?? '#000');
        this.closeColorPopovers();
        return;
      }
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.pf-fmt-btn');
      if (!btn) return;
      e.preventDefault(); // garde le focus/la sélection dans le champ

      const special = btn.dataset.special;
      if (special === 'color') {
        this.toggleColorPopover(btn);
        return;
      }
      if (special === 'link') {
        const url = window.prompt('Adresse du lien (URL) :', 'https://');
        if (url) this.applyFormat(btn, 'createLink', url);
        return;
      }
      this.applyFormat(btn, btn.dataset.cmd ?? '');
    });

    // Referme la palette de couleur au clic ailleurs.
    document.addEventListener('mousedown', (e) => {
      if (!(e.target as HTMLElement).closest('.pf-fmt-bar')) this.closeColorPopovers();
    });

    // Actions structurelles et images.
    this.aside.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-panel]');
      if (!btn) return;
      const action = btn.dataset.panel;
      const art = this.articleEl();

      switch (action) {
        case 'save':
          this.saveAll();
          break;
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
