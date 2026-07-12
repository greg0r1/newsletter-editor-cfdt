import { getAppSettings, saveAppSettings, uploadImage } from '../src/api/api';
import { compressImage } from '../src/edit/image';

// Dupliqué à l'identique dans public/theme-boot.js (script anti-FOUC, doit
// rester un fichier non-module synchrone, ne peut pas importer cette
// constante) — garder les deux synchronisés si l'une de ces valeurs change.
const THEME_KEY = 'cfdt-editor-theme';
const SCHEME_KEY = 'cfdt-editor-color-scheme';
const DEFAULT_THEME = 'orange';

const sideNav = document.getElementById('sideNav') as HTMLElement;
const panels = document.querySelectorAll<HTMLElement>('.panel');

sideNav.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.side-item');
  if (!btn?.dataset.panel) return;
  sideNav.querySelectorAll('.side-item').forEach((el) => el.classList.remove('active'));
  btn.classList.add('active');
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panelContent === btn.dataset.panel);
  });
});

const form = document.getElementById('settingsForm') as HTMLFormElement;
const logoPreviewWrap = document.getElementById('logoPreviewWrap') as HTMLElement;
const logoPreview = document.getElementById('logoPreview') as HTMLImageElement;
const logoInput = document.getElementById('logoInput') as HTMLInputElement;
const btnChangeLogo = document.getElementById('btnChangeLogo') as HTMLButtonElement;
const appTitleInput = document.getElementById('appTitleInput') as HTMLInputElement;
const statusEl = document.getElementById('settingsStatus') as HTMLElement;
const themeSwatches = document.getElementById('themeSwatches') as HTMLElement;
const schemeToggle = document.getElementById('schemeToggle') as HTMLElement;

/** Affiche le spinner tant que la nouvelle image n'a pas fini de charger. */
function setLogoPreview(url: string): void {
  logoPreviewWrap.classList.add('loading');
  logoPreview.hidden = true;
  logoPreview.onload = () => {
    logoPreviewWrap.classList.remove('loading');
    logoPreview.hidden = false;
  };
  logoPreview.onerror = () => {
    logoPreviewWrap.classList.remove('loading');
  };
  logoPreview.src = url;
}

async function boot(): Promise<void> {
  const settings = await getAppSettings();
  setLogoPreview(settings.logoUrl);
  appTitleInput.value = settings.appTitle;
  syncThemeUI();
  syncSchemeUI();
}

btnChangeLogo.addEventListener('click', () => logoInput.click());

logoInput.addEventListener('change', async () => {
  const file = logoInput.files?.[0];
  logoInput.value = '';
  if (!file) return;
  try {
    statusEl.textContent = 'Envoi du logo…';
    const blob = await compressImage(file);
    const url = await uploadImage(blob, file.name);
    setLogoPreview(url);
    statusEl.textContent = '';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Échec de l’envoi du logo.';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = 'Enregistrement…';
  try {
    await saveAppSettings({ logoUrl: logoPreview.src, appTitle: appTitleInput.value.trim() });
    statusEl.textContent = 'Enregistré.';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Échec de l’enregistrement.';
  }
});

function syncThemeUI(): void {
  const active = document.documentElement.dataset.theme || DEFAULT_THEME;
  themeSwatches.querySelectorAll<HTMLElement>('.theme-swatch').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeId === active);
  });
}

function syncSchemeUI(): void {
  const active = document.documentElement.dataset.colorScheme || 'light';
  schemeToggle.querySelectorAll<HTMLElement>('.scheme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.scheme === active);
  });
}

themeSwatches.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.theme-swatch');
  if (!btn?.dataset.themeId) return;
  document.documentElement.dataset.theme = btn.dataset.themeId;
  localStorage.setItem(THEME_KEY, btn.dataset.themeId);
  syncThemeUI();
});

schemeToggle.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.scheme-btn');
  if (!btn?.dataset.scheme) return;
  document.documentElement.dataset.colorScheme = btn.dataset.scheme;
  localStorage.setItem(SCHEME_KEY, btn.dataset.scheme);
  syncSchemeUI();
});

window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    syncThemeUI();
    syncSchemeUI();
  }
});

boot().catch((err) => {
  console.error(err);
  statusEl.textContent = 'Impossible de charger la configuration.';
});
