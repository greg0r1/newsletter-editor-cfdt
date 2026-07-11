import type { BlobImage } from '../state/state';
import { listImages, uploadImage } from '../api/api';
import { compressImage } from './image';

/**
 * Modale de choix d'image : galerie des images déjà envoyées (Vercel Blob)
 * + import d'un nouveau fichier (compressé comme partout ailleurs dans
 * l'app). Construite une seule fois puis réutilisée ; la galerie est
 * rechargée à chaque ouverture pour refléter les imports récents.
 */

let overlay: HTMLElement | null = null;
let grid: HTMLElement | null = null;
let dropzone: HTMLElement | null = null;
let modalFileInput: HTMLInputElement | null = null;
let onSelect: ((url: string) => void) | null = null;
/**
 * Incrémenté à chaque openImagePicker() : identifie la session d'ouverture
 * courante. Un upload en cours capture la génération au démarrage ; s'il se
 * termine après que la modale a été fermée/rouverte pour une autre cible
 * (génération différente), son résultat est ignoré au lieu d'être livré au
 * mauvais callback ou d'atterrir sur une modale déjà fermée.
 */
let generation = 0;
/** Vrai pendant qu'un upload est en cours — bloque la fermeture de la modale. */
let uploading = false;

function icon(paths: string): string {
  return (
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function renderGrid(images: BlobImage[]): void {
  if (!grid) return;
  if (images.length === 0) {
    grid.innerHTML = `<p class="image-picker-empty">Aucune image importée pour l'instant — importez-en une ci-dessus.</p>`;
    return;
  }
  grid.innerHTML = images
    .map(
      (img) =>
        `<button type="button" class="image-picker-thumb" data-url="${img.url}" ` +
        `aria-label="Utiliser cette image" title="${formatSize(img.size)}">` +
        `<img src="${img.url}" alt="" loading="lazy"></button>`,
    )
    .join('');
}

async function loadGallery(): Promise<void> {
  if (!grid) return;
  grid.innerHTML = `<p class="image-picker-loading">Chargement…</p>`;
  try {
    const images = await listImages();
    renderGrid(images);
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="image-picker-error">Impossible de charger la galerie d'images.</p>`;
  }
}

function setUploadError(message: string | null): void {
  const el = overlay?.querySelector<HTMLElement>('.image-picker-upload-error');
  if (!el) return;
  el.textContent = message ?? '';
  el.hidden = !message;
}

async function handleUpload(file: File): Promise<void> {
  setUploadError(null);
  dropzone?.classList.add('busy');
  uploading = true;
  const startedAt = generation;
  try {
    const compressed = await compressImage(file, 560, 0.82);
    const url = await uploadImage(compressed, file.name);
    // Si la modale a été fermée puis rouverte pour une autre cible pendant
    // l'upload, `generation` a changé : ce résultat n'a plus de destinataire
    // valide (onSelect appartient désormais à une autre session) — on ne
    // l'applique pas, silencieusement, l'image reste disponible dans la
    // galerie pour un prochain choix manuel.
    if (generation === startedAt) {
      onSelect?.(url);
      close();
    }
  } catch (err) {
    console.error(err);
    if (generation === startedAt) setUploadError('Import impossible : réessayez.');
  } finally {
    uploading = false;
    dropzone?.classList.remove('busy');
  }
}

function build(): void {
  overlay = document.createElement('div');
  overlay.className = 'image-picker-modal no-print';
  overlay.hidden = true;
  overlay.innerHTML =
    `<div class="image-picker-scrim" data-close></div>` +
    `<div class="image-picker-card" role="dialog" aria-modal="true" aria-label="Choisir une image">` +
    `<header class="image-picker-head">` +
    `<span class="image-picker-title">Choisir une image</span>` +
    `<button type="button" class="image-picker-close" data-close aria-label="Fermer">` +
    icon('<path d="M18 6 6 18M6 6l12 12"/>') +
    `</button>` +
    `</header>` +
    `<div class="image-picker-body">` +
    `<div class="image-picker-dropzone">` +
    icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>') +
    `<span>Glissez une image ici, ou</span>` +
    `<button type="button" class="tbtn" id="imagePickerChoose">Choisir un fichier</button>` +
    `<p class="image-picker-upload-error" hidden></p>` +
    `</div>` +
    `<div class="image-picker-grid"></div>` +
    `</div>` +
    `<footer class="image-picker-foot">` +
    `<button type="button" class="tbtn" data-close>Fermer</button>` +
    `</footer>` +
    `</div>`;

  document.body.appendChild(overlay);
  grid = overlay.querySelector('.image-picker-grid');
  dropzone = overlay.querySelector('.image-picker-dropzone');

  modalFileInput = document.createElement('input');
  modalFileInput.type = 'file';
  modalFileInput.accept = 'image/*';
  modalFileInput.hidden = true;
  overlay.appendChild(modalFileInput);

  overlay.addEventListener('click', (e) => {
    // Fermer ou choisir une image de galerie pendant qu'un import est déjà
    // en cours créerait une deuxième source concurrente pour le même
    // onSelect — on bloque toute autre interaction fermante jusqu'à la fin
    // de l'upload (voir handleUpload()).
    if (uploading) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-close]')) {
      close();
      return;
    }
    const thumb = target.closest<HTMLElement>('.image-picker-thumb');
    if (thumb?.dataset.url) {
      onSelect?.(thumb.dataset.url);
      close();
    }
  });

  overlay.querySelector('#imagePickerChoose')?.addEventListener('click', () => {
    modalFileInput?.click();
  });

  modalFileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (file) void handleUpload(file);
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone?.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', () => {
    dropzone?.classList.remove('dragover');
  });
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone?.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleUpload(file);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && !overlay.hidden && !uploading) close();
  });
}

function close(): void {
  if (overlay) overlay.hidden = true;
  document.body.classList.remove('image-picker-open');
  onSelect = null;
}

export function openImagePicker(callback: (url: string) => void): void {
  if (!overlay) build();
  generation++;
  onSelect = callback;
  setUploadError(null);
  if (overlay) overlay.hidden = false;
  document.body.classList.add('image-picker-open');
  void loadGallery();
}
