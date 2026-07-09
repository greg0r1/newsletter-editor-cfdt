import type { Article, Newsletter } from '../state/state';
import { articleHTML, renumber } from '../render/render';
import { saveNewsletter, uploadImage } from '../api/api';
import { compressImage } from './image';
import { EditPanel, type Selection } from './panel';

const SAVE_DELAY_MS = 700;

export type ImageTarget = 'article' | 'mast' | 'edito' | 'summer';

export class Editor {
  private root: HTMLElement;
  private saveIndicator: HTMLElement;
  private fileInput: HTMLInputElement;
  private panel: EditPanel;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingImageTarget: { kind: ImageTarget; articleEl: HTMLElement | null } | null = null;

  constructor(options: {
    root: HTMLElement;
    saveIndicator: HTMLElement;
    fileInput: HTMLInputElement;
    panelAside: HTMLElement;
    appContent: HTMLElement;
  }) {
    this.root = options.root;
    this.saveIndicator = options.saveIndicator;
    this.fileInput = options.fileInput;
    this.panel = new EditPanel({
      aside: options.panelAside,
      root: this.root,
      appContent: options.appContent,
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
        await saveNewsletter(data);
        this.setSaveIndicator('Enregistré', 'saved');
      } catch (err) {
        this.setSaveIndicator('Erreur de sauvegarde', 'error');
        console.error(err);
      }
    }, SAVE_DELAY_MS);
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
    this.panel.refresh();
    this.save();
  }

  private deleteArticle(artEl: HTMLElement): boolean {
    if (!confirm('Supprimer cet article ?')) return false;
    artEl.remove();
    renumber(this.root);
    this.save();
    return true;
  }

  private toggleHighlight(artEl: HTMLElement): HTMLElement | null {
    const existing = artEl.querySelector('.art-highlight');
    if (existing) {
      existing.remove();
      this.save();
      return null;
    }
    const hl = document.createElement('div');
    hl.className = 'art-highlight';
    hl.setAttribute('data-field', 'highlight');
    hl.textContent = 'Texte mis en avant…';
    artEl.appendChild(hl);
    this.save();
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
    this.pendingImageTarget = { kind, articleEl };
    this.fileInput.click();
  }

  private removeArticleImage(artEl: HTMLElement): void {
    artEl.querySelector('.img-wrap')?.remove();
    this.save();
  }

  private async handleImageFile(file: File): Promise<void> {
    const target = this.pendingImageTarget;
    if (!file || !target) return;
    const compressed = await compressImage(file, 560, 0.82);
    const url = await uploadImage(compressed, file.name);

    if (target.kind === 'article' && target.articleEl) {
      const wrap = target.articleEl.querySelector('.img-wrap');
      if (wrap) {
        wrap.querySelector('img')?.setAttribute('src', url);
      } else {
        const newWrap = document.createElement('div');
        newWrap.className = 'img-wrap';
        newWrap.innerHTML = `<img class="art-img" src="${url}">`;
        // L'image se place après le titre de l'article.
        const head = target.articleEl.querySelector('.art-head');
        head?.after(newWrap);
      }
    } else if (target.kind === 'mast') {
      this.root.querySelector('.mast-right img')?.setAttribute('src', url);
    } else if (target.kind === 'edito') {
      this.root.querySelector('.edito-sun img')?.setAttribute('src', url);
    } else if (target.kind === 'summer') {
      this.root.querySelector('.box-summer .sun-mini')?.setAttribute('src', url);
    }

    this.pendingImageTarget = null;
    this.save();
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

    this.fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (file) void this.handleImageFile(file);
    });
  }
}
