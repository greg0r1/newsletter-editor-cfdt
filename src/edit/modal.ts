/**
 * Registre partagé des modales plein écran (aide, choix d'image, aperçu
 * email). Garantit qu'une seule est visible à la fois — comme `menu.ts` le
 * fait déjà pour les menus déroulants — et centralise l'unique listener
 * Escape global, pour éviter qu'un Escape ferme plusieurs modales à la fois
 * si l'une d'elles a été ouverte par-dessus une autre déjà affichée.
 */

interface RegisteredModal {
  overlay: HTMLElement;
  close: () => void;
  /** Vrai si la modale refuse de se fermer (ex : upload en cours). */
  isBusy?: () => boolean;
}

const registered: RegisteredModal[] = [];
let globalListenersBound = false;

function bindGlobalListeners(): void {
  if (globalListenersBound) return;
  globalListenersBound = true;

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = registered.find((m) => !m.overlay.hidden);
    if (open && !open.isBusy?.()) open.close();
  });
}

/** Déclare une modale auprès du registre. À appeler une seule fois, dans build(). */
export function registerModal(modal: RegisteredModal): void {
  registered.push(modal);
  bindGlobalListeners();
}

/** Ferme toute modale déjà ouverte, sauf `except`. À appeler avant d'afficher une nouvelle modale. */
export function closeOtherModals(except: HTMLElement): void {
  for (const m of registered) {
    if (m.overlay !== except && !m.overlay.hidden && !m.isBusy?.()) m.close();
  }
}
