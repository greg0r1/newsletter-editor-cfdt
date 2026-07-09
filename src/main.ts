import './styles/style.css';
import './styles/print.css';
import type { Newsletter } from './state/state';
import { renderAll } from './render/render';
import { Editor } from './edit/edit';
import { bindPanelResize } from './edit/panel';
import { getNewsletter, saveNewsletter, logout } from './api/api';
import { exportJSON, importJSON } from './api/importExport';

const root = document.getElementById('newsletterRoot') as HTMLElement;
const saveIndicator = document.getElementById('saveIndicator') as HTMLElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const importInput = document.getElementById('importInput') as HTMLInputElement;
const panelAside = document.getElementById('editPanel') as HTMLElement;
const panelResizeHandle = document.getElementById('panelResizeHandle') as HTMLElement;
const appContent = document.getElementById('appContent') as HTMLElement;
const bootLoader = document.getElementById('bootLoader') as HTMLElement;

const editor = new Editor({ root, saveIndicator, fileInput, panelAside, appContent });
bindPanelResize(panelResizeHandle, panelAside);

// Le panneau (sticky) doit se caler sous la toolbar (elle aussi sticky) : on
// mesure sa hauteur réelle, qui varie selon la largeur de fenêtre (flex-wrap).
const toolbarEl = document.querySelector<HTMLElement>('.toolbar');
if (toolbarEl) {
  const syncToolbarHeight = (): void => {
    document.documentElement.style.setProperty('--toolbar-height', `${toolbarEl.offsetHeight}px`);
  };
  new ResizeObserver(syncToolbarHeight).observe(toolbarEl);
  syncToolbarHeight();
}

async function boot(): Promise<void> {
  saveIndicator.textContent = 'Chargement…';
  const state = await getNewsletter();
  root.dataset.newsletterId = state.id;
  renderAll(root, state);
  saveIndicator.textContent = 'Chargé';
  appContent.classList.remove('loading');
  bootLoader.classList.add('hidden');
}

function loadInto(state: Newsletter): void {
  // renderAll reconstruit la feuille : les références miroir du panneau
  // deviennent orphelines, on le ferme donc avant de re-rendre.
  editor.closePanel();
  root.dataset.newsletterId = state.id;
  renderAll(root, state);
}

document.getElementById('btnAdd')?.addEventListener('click', () => {
  editor.addArticle();
});

document.getElementById('btnPrint')?.addEventListener('click', () => window.print());

document.getElementById('btnExport')?.addEventListener('click', () => {
  exportJSON(editor.serialize());
});

document.getElementById('btnImportTrigger')?.addEventListener('click', () => {
  importInput.click();
});

importInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  try {
    const data = await importJSON(file);
    loadInto(data);
    await saveNewsletter(editor.serialize());
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Import impossible.');
  }
});

document.getElementById('btnReset')?.addEventListener('click', async () => {
  if (!confirm('Réinitialiser tout le contenu ? Cette action est irréversible.')) return;
  const state = await getNewsletter();
  loadInto(state);
});

document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await logout();
  window.location.href = '/login/';
});

boot().catch((err) => {
  console.error(err);
  saveIndicator.textContent = 'Erreur de chargement';
  bootLoader.textContent = 'Erreur de chargement. Rechargez la page.';
});
