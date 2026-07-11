import type { ImageTarget } from '../edit';
import { HTML_FIELDS, renderArticle, renderEdito, renderInfo, renderMast, renderSummer } from './templates';

/** Bloc actuellement édité dans le panneau. */
export type Selection =
  | { kind: 'article'; el: HTMLElement }
  | { kind: 'mast' }
  | { kind: 'edito' }
  | { kind: 'info' }
  | { kind: 'summer' };

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
  private scrim: HTMLElement | null;
  private selection: Selection | null = null;
  private dirty = false;
  /**
   * Sections repliées, par id (ex. "article:image"). Partagée entre toutes
   * les sélections/re-rendus du panneau (persiste tant que la page n'est pas
   * rechargée) : replier "Position" sur un article doit rester replié en
   * rouvrant un autre article.
   */
  private collapsed = new Set<string>();

  constructor(opts: {
    aside: HTMLElement;
    root: HTMLElement;
    appContent: HTMLElement;
    scrim?: HTMLElement | null;
    callbacks: PanelCallbacks;
  }) {
    this.aside = opts.aside;
    this.root = opts.root;
    this.appContent = opts.appContent;
    this.scrim = opts.scrim ?? null;
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
    this.appContent.classList.remove('panel-open');
    // Laisse le contenu en place le temps de l'animation de sortie (slide),
    // pour éviter qu'il ne disparaisse d'un coup pendant que le panneau glisse
    // encore hors champ. Vidé une fois la transition CSS terminée (320ms,
    // cf. .edit-panel dans style.css — garder ces deux durées synchronisées).
    const aside = this.aside;
    window.setTimeout(() => {
      if (!this.selection) aside.innerHTML = '';
    }, 340);
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
        return renderArticle(this.collapsed, sel.el);
      case 'mast':
        return renderMast(this.collapsed);
      case 'edito':
        return renderEdito(this.collapsed);
      case 'info':
        return renderInfo(this.collapsed);
      case 'summer':
        return renderSummer(this.collapsed);
    }
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

    this.refreshToggleAllButton();
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

  /**
   * Replie/déplie une section sans passer par un re-rendu complet (`render()`
   * viderait/recréerait les champs et perdrait la sélection de texte en cours).
   * Bascule directement la classe CSS et l'état ARIA sur les éléments existants.
   */
  private toggleSection(id: string): void {
    if (!id) return;
    const section = this.aside.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!section) return;
    const willCollapse = !section.classList.contains('pf-collapsed');
    section.classList.toggle('pf-collapsed', willCollapse);
    section.querySelector('.pf-section-head')?.setAttribute('aria-expanded', String(!willCollapse));
    if (willCollapse) this.collapsed.add(id);
    else this.collapsed.delete(id);
    this.refreshToggleAllButton();
  }

  /**
   * Réduit toutes les sections si au moins une est actuellement dépliée,
   * sinon les déplie toutes (comportement "tout réduire" prioritaire, cohérent
   * avec l'icône affichée par `refreshToggleAllButton()`).
   */
  private toggleAllSections(): void {
    const sections = this.aside.querySelectorAll<HTMLElement>('[data-section]');
    const shouldCollapse = Array.from(sections).some((s) => !s.classList.contains('pf-collapsed'));
    sections.forEach((section) => {
      section.classList.toggle('pf-collapsed', shouldCollapse);
      section.querySelector('.pf-section-head')?.setAttribute('aria-expanded', String(!shouldCollapse));
      const id = section.dataset.section;
      if (!id) return;
      if (shouldCollapse) this.collapsed.add(id);
      else this.collapsed.delete(id);
    });
    this.refreshToggleAllButton();
  }

  /** Bascule l'icône/label du bouton "Tout réduire/déplier" selon l'état courant. */
  private refreshToggleAllButton(): void {
    const btn = this.aside.querySelector<HTMLElement>('.pf-toggle-all');
    if (!btn) return;
    const sections = this.aside.querySelectorAll('[data-section]');
    const anyExpanded = Array.from(sections).some((s) => !s.classList.contains('pf-collapsed'));
    btn.classList.toggle('pf-all-collapsed', !anyExpanded);
    const label = btn.querySelector('.pf-toggle-all-label');
    if (label) label.textContent = anyExpanded ? 'Tout réduire' : 'Tout déplier';
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
    // Voile derrière le panneau (overlay) : clic pour fermer, comme un clic
    // en dehors d'une modale.
    this.scrim?.addEventListener('click', () => this.close());

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
        case 'toggleSection':
          this.toggleSection(btn.dataset.sectionId ?? '');
          break;
        case 'toggleAllSections':
          this.toggleAllSections();
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

export { bindPanelResize } from './resize';
