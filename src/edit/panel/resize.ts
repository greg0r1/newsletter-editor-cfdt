const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 900;
const PANEL_WIDTH_STORAGE_KEY = 'editPanelWidth';

/**
 * Câble la poignée de redimensionnement horizontal du panneau (drag souris).
 * La largeur est bornée entre PANEL_MIN_WIDTH et PANEL_MAX_WIDTH, et persistée
 * en sessionStorage pour survivre à un rechargement de page.
 */
export function bindPanelResize(handle: HTMLElement, aside: HTMLElement): void {
  // Posée sur <html> plutôt que sur `aside` : `.pf-resize-handle` (poignée)
  // et `.edit-panel` sont des frères en `position: fixed` (overlay, voir
  // style.css), pas parent/enfant — la variable doit donc être visible depuis
  // la racine pour que les deux la lisent (le CSS custom property hérite
  // par arbre DOM, pas par proximité visuelle).
  const rootStyle = document.documentElement.style;
  const stored = Number(sessionStorage.getItem(PANEL_WIDTH_STORAGE_KEY));
  if (stored) rootStyle.setProperty('--panel-width', `${clampWidth(stored)}px`);

  function clampWidth(w: number): number {
    const max = Math.min(PANEL_MAX_WIDTH, window.innerWidth * 0.7);
    return Math.max(PANEL_MIN_WIDTH, Math.min(w, max));
  }

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = aside.getBoundingClientRect().width;
    document.body.classList.add('panel-resizing');

    function onMove(ev: MouseEvent): void {
      const width = clampWidth(startWidth - (ev.clientX - startX));
      rootStyle.setProperty('--panel-width', `${width}px`);
    }
    function onUp(): void {
      document.body.classList.remove('panel-resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const width = aside.getBoundingClientRect().width;
      if (width) sessionStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(Math.round(width)));
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}
