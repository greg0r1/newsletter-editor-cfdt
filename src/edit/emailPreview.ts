import type { Newsletter } from '../state/state';
import { emailDocumentHTML, exportEmailHTML } from '../api/exportEmail';
import { registerModal, closeOtherModals } from './modal';

/**
 * Modale d'aperçu de l'export email. Affiche le rendu email (via un <iframe>
 * srcdoc, isolé du CSS de l'app) et propose son téléchargement. Un bascule
 * Desktop/Mobile change la largeur de l'iframe pour prévisualiser le rendu
 * responsive. Construite une seule fois puis réutilisée ; le contenu est
 * recalculé à chaque ouverture pour refléter l'état courant.
 */

// Largeur mobile de prévisualisation (proche d'un smartphone) ; déclenche les
// media queries responsive de l'email (seuil 600px).
const MOBILE_WIDTH = 390;

let overlay: HTMLElement | null = null;
let frame: HTMLIFrameElement | null = null;
let currentState: Newsletter | null = null;

function icon(paths: string): string {
  return (
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

function setMode(mode: 'desktop' | 'mobile'): void {
  if (!overlay || !frame) return;
  overlay.querySelectorAll<HTMLElement>('.email-modal-mode').forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  frame.style.width = mode === 'mobile' ? `${MOBILE_WIDTH}px` : '100%';
}

function build(): void {
  overlay = document.createElement('div');
  overlay.className = 'email-modal no-print';
  overlay.hidden = true;
  overlay.innerHTML =
    `<div class="email-modal-scrim" data-close></div>` +
    `<div class="email-modal-card" role="dialog" aria-modal="true" aria-label="Aperçu de l'export email">` +
    `<header class="email-modal-head">` +
    `<span class="email-modal-title">Aperçu email</span>` +
    `<div class="email-modal-modes" role="group" aria-label="Largeur d'aperçu">` +
    `<button type="button" class="email-modal-mode active" data-mode="desktop" aria-pressed="true">` +
    icon('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>') +
    `<span>Desktop</span></button>` +
    `<button type="button" class="email-modal-mode" data-mode="mobile" aria-pressed="false">` +
    icon('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>') +
    `<span>Mobile</span></button>` +
    `</div>` +
    `<button type="button" class="email-modal-close" data-close aria-label="Fermer">` +
    icon('<path d="M18 6 6 18M6 6l12 12"/>') +
    `</button>` +
    `</header>` +
    `<div class="email-modal-body"><iframe class="email-modal-frame" title="Aperçu email"></iframe></div>` +
    `<footer class="email-modal-foot">` +
    `<button type="button" class="tbtn" data-close>Fermer</button>` +
    `<button type="button" class="tbtn primary" id="emailPreviewDownload">` +
    icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>') +
    `<span>Télécharger le HTML</span></button>` +
    `</footer>` +
    `</div>`;

  document.body.appendChild(overlay);
  frame = overlay.querySelector('.email-modal-frame');

  overlay.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-close]')) close();
  });

  overlay.querySelectorAll<HTMLElement>('.email-modal-mode').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode as 'desktop' | 'mobile'));
  });

  overlay.querySelector('#emailPreviewDownload')?.addEventListener('click', () => {
    if (currentState) exportEmailHTML(currentState);
  });

  registerModal({ overlay, close });
}

function close(): void {
  if (overlay) overlay.hidden = true;
  document.body.classList.remove('email-modal-open');
}

export function openEmailPreview(state: Newsletter): void {
  if (!overlay) build();
  if (!overlay) return;
  closeOtherModals(overlay);
  currentState = state;
  if (frame) frame.srcdoc = emailDocumentHTML(state);
  setMode('desktop');
  overlay.hidden = false;
  document.body.classList.add('email-modal-open');
}
