import type { Article, Newsletter } from './state';
import { articleHTML, renumber } from './render';
import { saveNewsletter, uploadImage } from './api';
import { compressImage } from './image';

const RICH_FIELDS = new Set(['body', 'editoBody', 'infoBody', 'summerBody', 'highlight']);
const SAVE_DELAY_MS = 700;

type ImageTarget = 'article' | 'mast' | 'edito' | 'summer';

export class Editor {
  private root: HTMLElement;
  private saveIndicator: HTMLElement;
  private fileInput: HTMLInputElement;
  private fmtToolbar: HTMLElement;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingImageTarget: { kind: ImageTarget; articleEl: HTMLElement | null } | null = null;
  private currentFmtTarget: HTMLElement | null = null;

  constructor(options: {
    root: HTMLElement;
    saveIndicator: HTMLElement;
    fileInput: HTMLInputElement;
    fmtToolbar: HTMLElement;
  }) {
    this.root = options.root;
    this.saveIndicator = options.saveIndicator;
    this.fileInput = options.fileInput;
    this.fmtToolbar = options.fmtToolbar;
    this.bindEvents();
  }

  private setSaveIndicator(text: string): void {
    this.saveIndicator.textContent = text;
  }

  private scheduleSave(): void {
    this.setSaveIndicator('Sauvegarde…');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        const data = this.serialize();
        await saveNewsletter(data);
        this.setSaveIndicator('Enregistré ✓');
      } catch (err) {
        this.setSaveIndicator('Erreur de sauvegarde');
        console.error(err);
      }
    }, SAVE_DELAY_MS);
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
    this.scheduleSave();
  }

  private deleteArticle(artEl: HTMLElement): void {
    if (!confirm('Supprimer cet article ?')) return;
    artEl.remove();
    renumber(this.root);
    this.scheduleSave();
  }

  private toggleHighlight(artEl: HTMLElement, btn: HTMLElement): void {
    const existing = artEl.querySelector('.art-highlight');
    if (existing) {
      existing.remove();
      btn.textContent = '+ encart';
    } else {
      const hl = document.createElement('div');
      hl.className = 'art-highlight editable';
      hl.setAttribute('contenteditable', 'true');
      hl.setAttribute('data-field', 'highlight');
      hl.textContent = 'Texte mis en avant…';
      artEl.appendChild(hl);
      btn.textContent = '− encart';
      hl.focus();
      document.execCommand('selectAll', false);
    }
    this.scheduleSave();
  }

  private addArticle(): void {
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
    const wrapper = document.createElement('div');
    wrapper.innerHTML = articleHTML(data);
    const node = wrapper.firstElementChild as HTMLElement;
    const addBtn = this.root.querySelector('[data-action="addArticle"]');
    addBtn?.parentElement?.insertBefore(node, addBtn);
    renumber(this.root);
    this.scheduleSave();
    const titleField = node.querySelector<HTMLElement>('[data-field="title"]');
    titleField?.focus();
    document.execCommand('selectAll', false);
  }

  private requestImage(kind: ImageTarget, articleEl: HTMLElement | null): void {
    this.pendingImageTarget = { kind, articleEl };
    this.fileInput.click();
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
        const placeholder = target.articleEl.querySelector('.no-img-placeholder');
        const newWrap = document.createElement('div');
        newWrap.className = 'img-wrap';
        newWrap.innerHTML =
          `<img class="art-img" src="${url}">` +
          `<button class="mini-btn img-btn no-print" data-action="changeImage" title="Changer l'image">🖼 Changer</button>`;
        placeholder?.replaceWith(newWrap);
      }
    } else if (target.kind === 'mast') {
      this.root.querySelector('.mast-right img')?.setAttribute('src', url);
    } else if (target.kind === 'edito') {
      this.root.querySelector('.edito-sun img')?.setAttribute('src', url);
    } else if (target.kind === 'summer') {
      this.root.querySelector('.box-summer .sun-mini')?.setAttribute('src', url);
    }

    this.scheduleSave();
  }

  private showFmtToolbar(target: HTMLElement): void {
    const r = target.getBoundingClientRect();
    this.fmtToolbar.style.display = 'flex';
    this.fmtToolbar.style.top = `${window.scrollY + r.top - 38}px`;
    this.fmtToolbar.style.left = `${window.scrollX + r.left}px`;
    this.currentFmtTarget = target;
  }

  private hideFmtToolbar(): void {
    this.fmtToolbar.style.display = 'none';
  }

  private bindEvents(): void {
    this.root.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList?.contains('editable')) this.scheduleSave();
    });

    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const artEl = btn.closest<HTMLElement>('.art');

      switch (action) {
        case 'moveUp':
          if (artEl) this.moveArticle(artEl, 'up');
          break;
        case 'moveDown':
          if (artEl) this.moveArticle(artEl, 'down');
          break;
        case 'deleteArticle':
          if (artEl) this.deleteArticle(artEl);
          break;
        case 'toggleHighlight':
          if (artEl) this.toggleHighlight(artEl, btn);
          break;
        case 'changeImage':
          this.requestImage('article', artEl);
          break;
        case 'changeMastImage':
          this.requestImage('mast', null);
          break;
        case 'changeEditoImage':
          this.requestImage('edito', null);
          break;
        case 'changeSummerImage':
          this.requestImage('summer', null);
          break;
        case 'addArticle':
          this.addArticle();
          break;
      }
    });

    this.fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (file) void this.handleImageFile(file);
    });

    document.addEventListener('focusin', (e) => {
      const field = (e.target as HTMLElement).getAttribute?.('data-field');
      if (field && RICH_FIELDS.has(field)) this.showFmtToolbar(e.target as HTMLElement);
    });
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active?.closest?.('.editable')) this.hideFmtToolbar();
      }, 150);
    });
    this.fmtToolbar.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      document.execCommand(btn.getAttribute('data-cmd') ?? '', false);
      if (this.currentFmtTarget) this.scheduleSave();
    });

    window.addEventListener('beforeprint', () => this.hideFmtToolbar());
  }
}
