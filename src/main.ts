import './style.css';
import './print.css';
import type { Newsletter } from './state';
import { renderAll } from './render';
import { Editor } from './edit';
import { getNewsletter, saveNewsletter, logout } from './api';
import { exportJSON, importJSON } from './importExport';

const root = document.getElementById('newsletterRoot') as HTMLElement;
const saveIndicator = document.getElementById('saveIndicator') as HTMLElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const importInput = document.getElementById('importInput') as HTMLInputElement;
const fmtToolbar = document.getElementById('fmtToolbar') as HTMLElement;
const appContent = document.getElementById('appContent') as HTMLElement;
const bootLoader = document.getElementById('bootLoader') as HTMLElement;

const editor = new Editor({ root, saveIndicator, fileInput, fmtToolbar });

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
  root.dataset.newsletterId = state.id;
  renderAll(root, state);
}

document.getElementById('btnAdd')?.addEventListener('click', () => {
  root.querySelector<HTMLElement>('[data-action="addArticle"]')?.click();
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
