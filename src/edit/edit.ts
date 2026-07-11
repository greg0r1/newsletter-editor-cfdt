import type { Article, Newsletter } from '../state/state';
import { articleHTML, renumber } from '../render/render';
import { saveNewsletter } from '../api/api';
import { openImagePicker } from './imagePicker';
import { EditPanel, type Selection } from './panel';

const SAVE_DELAY_MS = 700;

export type ImageTarget = 'article' | 'mast' | 'edito' | 'summer';

export class Editor {
  private root: HTMLElement;
  private saveIndicator: HTMLElement;
  private panel: EditPanel;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: {
    root: HTMLElement;
    saveIndicator: HTMLElement;
    panelAside: HTMLElement;
    panelScrim?: HTMLElement | null;
    appContent: HTMLElement;
  }) {
    this.root = options.root;
    this.saveIndicator = options.saveIndicator;
    this.panel = new EditPanel({
      aside: options.panelAside,
      root: this.root,
      appContent: options.appContent,
      scrim: options.panelScrim,
      callbacks: {
        onChange: () => this.save(),
        onRequestImage: (kind, articleEl) => this.requestImage(kind, articleEl),
        onRemoveArticleImage: (articleEl) => this.removeArticleImage(articleEl),
        onMoveArticle: (articleEl, dir) => this.moveArticle(articleEl, dir),
        onMoveArticleTo: (articleEl, index) => this.moveArticleTo(articleEl, index),
        onToggleHighlight: (articleEl) => this.toggleHighlight(articleEl),
        onDeleteArticle: (articleEl) => this.deleteArticle(articleEl),
      },
    });
    this.bindEvents();
  }

  private setSaveIndicator(text: string, state: 'saving' | 'saved' | 'error'): void {
    this.saveIndicator.textContent = text;
    this.saveIndicator.dataset.state = state;
  }

  /** Déclenche la sauvegarde debounced. Point d'entrée public (utilisé par le panneau). */
  save(): void {
    this.setSaveIndicator('Sauvegarde…', 'saving');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        const data = this.serialize();
        const saved = await saveNewsletter(data);
        this.syncArticleIds(saved.articles);
        this.setSaveIndicator('Enregistré', 'saved');
      } catch (err) {
        this.setSaveIndicator('Erreur de sauvegarde', 'error');
        console.error(err);
      }
    }, SAVE_DELAY_MS);
  }

  /**
   * Remplace les ids temporaires (`tmp-*`, posés par `addArticle()`) par les
   * vrais UUID renvoyés par le serveur après l'INSERT. Sans ça, une sauvegarde
   * suivante renverrait le même article comme "nouveau" (id toujours non-UUID)
   * et créerait un doublon en base.
   */
  private syncArticleIds(saved: Article[]): void {
    const articleEls = Array.from(this.root.querySelectorAll<HTMLElement>('#articlesContainer .art'));
    articleEls.forEach((el, i) => {
      const realId = saved[i]?.id;
      if (realId && el.getAttribute('data-id') !== realId) {
        el.setAttribute('data-id', realId);
      }
    });
  }

  /** Ferme le panneau (appelé après un import/reset qui reconstruit la feuille). */
  closePanel(): void {
    this.panel.close();
  }

  private text(selector: string): string {
    const el = this.root.querySelector(selector);
    return el ? (el.textContent ?? '').trim() : '';
  }

  private html(selector: string): string {
    const el = this.root.querySelector(selector);
    return el ? el.innerHTML.trim() : '';
  }

  serialize(): Newsletter {
    const articleEls = Array.from(this.root.querySelectorAll<HTMLElement>('#articlesContainer .art'));
    const articles: Article[] = articleEls.map((el, i) => {
      const img = el.querySelector<HTMLImageElement>('.art-img');
      const hl = el.querySelector<HTMLElement>('.art-highlight');
      const titleField = el.querySelector<HTMLElement>('[data-field="title"]');
      const bodyField = el.querySelector<HTMLElement>('[data-field="body"]');
      return {
        id: el.getAttribute('data-id') ?? '',
        position: i,
        title: titleField ? titleField.innerHTML.trim() : '',
        imageUrl: img ? img.getAttribute('src') : null,
        body: bodyField ? bodyField.innerHTML.trim() : '',
        highlight: hl ? hl.innerHTML.trim() : null,
        updatedAt: new Date().toISOString(),
      };
    });

    const mastImg = this.root.querySelector<HTMLImageElement>('.mast-right img');
    const editoImg = this.root.querySelector<HTMLImageElement>('.edito-sun img');
    const summerImg = this.root.querySelector<HTMLImageElement>('.box-summer .sun-mini');

    return {
      id: this.root.dataset.newsletterId ?? '',
      mast: {
        orgLines: this.html('[data-field="mastOrg"]'),
        titleAccent: this.text('[data-field="titleAccent"]'),
        titleRest: this.text('[data-field="titleRest"]'),
        period: this.text('[data-field="period"]'),
        image: mastImg?.getAttribute('src') ?? '',
      },
      edito: {
        hello: this.text('[data-field="editoHello"]'),
        body: this.html('[data-field="editoBody"]'),
        signature: this.text('[data-field="editoSign"]'),
        image: editoImg?.getAttribute('src') ?? '',
      },
      articles,
      infoBox: {
        title: this.text('[data-field="infoTitle"]'),
        body: this.html('[data-field="infoBody"]'),
      },
      summerBox: {
        title: this.text('[data-field="summerTitle"]'),
        body: this.html('[data-field="summerBody"]'),
        signature: this.text('[data-field="summerSign"]'),
        image: summerImg?.getAttribute('src') ?? '',
      },
    };
  }

  // -------------------------------------------------- mutations sur articles

  /**
   * Sauvegarde immédiate (pas recordUndo()) : le déplacement change la
   * position dans le parent, pas le contenu du bloc édité, donc il n'entre
   * pas dans le mécanisme d'annulation à la fermeture (voir EditPanel.
   * discardUnsavedChanges()) — afficher "Modifications non enregistrées"
   * ici serait trompeur puisqu'il n'y aurait rien à en faire.
   *
   * Comme cette sauvegarde sérialise TOUT le DOM (Editor.serialize()), elle
   * enverrait de toute façon au serveur une éventuelle mutation en attente
   * sur ce même article (image/encart non encore "Enregistrée") — on
   * confirme donc explicitement ce brouillon plutôt que de laisser le
   * panneau croire qu'il reste annulable alors que le serveur l'aura déjà
   * reçu (discardPendingUndo() vide la pile d'annulation sans y toucher,
   * l'article garde sa nouvelle image/encart tel quel).
   */
  private moveArticle(artEl: HTMLElement, dir: 'up' | 'down'): void {
    const parent = artEl.parentElement;
    if (!parent) return;
    if (dir === 'up') {
      const prev = artEl.previousElementSibling;
      if (prev?.classList.contains('art')) parent.insertBefore(artEl, prev);
    } else {
      const next = artEl.nextElementSibling;
      if (next?.classList.contains('art')) parent.insertBefore(next, artEl);
    }
    renumber(this.root);
    this.panel.discardPendingUndo();
    this.panel.refresh();
    this.save();
  }

  private moveArticleTo(artEl: HTMLElement, index: number): void {
    const parent = artEl.parentElement;
    if (!parent) return;
    const articles = Array.from(parent.querySelectorAll<HTMLElement>('.art'));
    const clamped = Math.max(0, Math.min(index, articles.length - 1));
    const target = articles[clamped];
    if (!target || target === artEl) return;
    const goingDown = articles.indexOf(artEl) < clamped;
    parent.insertBefore(artEl, goingDown ? target.nextElementSibling : target);
    renumber(this.root);
    this.panel.discardPendingUndo();
    this.panel.refresh();
    this.save();
  }

  /**
   * Seule mutation structurelle qui sauvegarde encore immédiatement (au lieu
   * d'attendre "Enregistrer") : elle ferme le panneau juste après (voir
   * EditPanel.bindEvents, case 'delete'), qui remettrait sinon le badge
   * "non enregistré" à zéro sans jamais avoir pu être validé. La confirmation
   * confirm() ci-dessous joue déjà le rôle de garde-fou contre l'erreur.
   */
  private deleteArticle(artEl: HTMLElement): boolean {
    if (!confirm('Supprimer cet article ?')) return false;
    artEl.remove();
    renumber(this.root);
    // Les mutations en attente sur cet article (image, encart) n'ont plus
    // de sens à annuler puisque le bloc entier disparaît avec la sauvegarde
    // immédiate ci-dessous — voir EditPanel.discardPendingUndo().
    this.panel.discardPendingUndo();
    this.save();
    return true;
  }

  private toggleHighlight(artEl: HTMLElement): HTMLElement | null {
    const existing = artEl.querySelector<HTMLElement>('.art-highlight');
    if (existing) {
      const anchor = existing.previousElementSibling;
      existing.remove();
      this.panel.recordUndo(() => {
        if (anchor) anchor.after(existing);
        else artEl.prepend(existing);
      });
      return null;
    }
    const hl = document.createElement('div');
    hl.className = 'art-highlight';
    hl.setAttribute('data-field', 'highlight');
    hl.textContent = 'Texte mis en avant…';
    artEl.appendChild(hl);
    this.panel.recordUndo(() => hl.remove());
    return hl;
  }

  /** Ajoute un article en fin de liste et ouvre le panneau dessus. */
  addArticle(): void {
    const id = `tmp-${Date.now()}`;
    const data: Article = {
      id,
      position: 0,
      title: 'Nouveau titre',
      imageUrl: null,
      body: "<p>Texte de l'article…</p>",
      highlight: null,
      updatedAt: new Date().toISOString(),
    };
    const container = this.root.querySelector<HTMLElement>('#articlesContainer');
    if (!container) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = articleHTML(data);
    const node = wrapper.firstElementChild as HTMLElement;
    container.appendChild(node);
    renumber(this.root);
    this.save();
    this.panel.open({ kind: 'article', el: node });
  }

  // ------------------------------------------------------------- images

  private requestImage(kind: ImageTarget, articleEl: HTMLElement | null): void {
    openImagePicker((url) => this.applyImage({ kind, articleEl }, url));
  }

  private removeArticleImage(artEl: HTMLElement): void {
    const wrap = artEl.querySelector<HTMLElement>('.img-wrap');
    if (!wrap) return;
    const anchor = wrap.previousElementSibling;
    wrap.remove();
    this.panel.recordUndo(() => {
      if (anchor) anchor.after(wrap);
      else artEl.prepend(wrap);
    });
  }

  /** Change la `src` d'un `<img>` existant ; empile l'annulation (ancienne src). */
  private replaceImageSrc(img: HTMLImageElement, url: string): void {
    const previous = img.getAttribute('src');
    img.setAttribute('src', url);
    this.panel.recordUndo(() => {
      if (previous != null) img.setAttribute('src', previous);
      else img.removeAttribute('src');
    });
  }

  private applyImage(target: { kind: ImageTarget; articleEl: HTMLElement | null }, url: string): void {
    if (target.kind === 'article' && target.articleEl) {
      const wrap = target.articleEl.querySelector<HTMLImageElement>('.img-wrap img');
      if (wrap) {
        this.replaceImageSrc(wrap, url);
      } else {
        const newWrap = document.createElement('div');
        newWrap.className = 'img-wrap';
        newWrap.innerHTML = `<img class="art-img" src="${url}">`;
        // L'image se place après le titre de l'article.
        const head = target.articleEl.querySelector('.art-head');
        head?.after(newWrap);
        this.panel.recordUndo(() => newWrap.remove());
      }
    } else if (target.kind === 'mast') {
      const img = this.root.querySelector<HTMLImageElement>('.mast-right img');
      if (img) this.replaceImageSrc(img, url);
    } else if (target.kind === 'edito') {
      const img = this.root.querySelector<HTMLImageElement>('.edito-sun img');
      if (img) this.replaceImageSrc(img, url);
    } else if (target.kind === 'summer') {
      const img = this.root.querySelector<HTMLImageElement>('.box-summer .sun-mini');
      if (img) this.replaceImageSrc(img, url);
    }

    // Aperçu immédiat dans la feuille, mais la sauvegarde serveur attend
    // désormais le clic sur "Enregistrer" du panneau — comme un champ texte.
    this.panel.refresh();
  }

  // --------------------------------------------------------------- events

  /** Détermine le bloc sélectionné à partir d'un clic dans la feuille. */
  private selectionFromTarget(target: HTMLElement): Selection | null {
    const art = target.closest<HTMLElement>('.art');
    if (art) return { kind: 'article', el: art };
    if (target.closest('.mast')) return { kind: 'mast' };
    if (target.closest('.edito')) return { kind: 'edito' };
    if (target.closest('.box-info')) return { kind: 'info' };
    if (target.closest('.box-summer')) return { kind: 'summer' };
    return null;
  }

  private bindEvents(): void {
    // Clic sur un bloc de la feuille → ouvre le panneau d'édition.
    this.root.addEventListener('click', (e) => {
      const sel = this.selectionFromTarget(e.target as HTMLElement);
      if (sel) this.panel.open(sel);
    });
  }
}
