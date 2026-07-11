/**
 * Menu déroulant minimal ancré sous un bouton déclencheur. Vanilla, sans
 * dépendance. Un seul menu ouvert à la fois dans toute la page (registre
 * global). Fermeture au clic extérieur, à Escape, ou à la sélection d'un item.
 */

// Tous les menus enregistrés, pour pouvoir n'en garder qu'un seul ouvert.
const registered: Array<{ trigger: HTMLElement; menu: HTMLElement }> = [];
let globalListenersBound = false;

function closeMenu(trigger: HTMLElement, menu: HTMLElement): void {
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
}

function closeAll(except?: HTMLElement): void {
  for (const { trigger, menu } of registered) {
    if (menu !== except) closeMenu(trigger, menu);
  }
}

function bindGlobalListeners(): void {
  if (globalListenersBound) return;
  globalListenersBound = true;

  // Clic hors de tout menu/trigger ouvert → ferme tout.
  document.addEventListener('click', (e) => {
    const target = e.target as Node;
    const inside = registered.some(
      ({ trigger, menu }) => trigger.contains(target) || menu.contains(target),
    );
    if (!inside) closeAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
}

/** Câble un bouton déclencheur à son menu déroulant. */
export function setupMenu(trigger: HTMLElement, menu: HTMLElement): void {
  registered.push({ trigger, menu });
  bindGlobalListeners();

  menu.hidden = true;
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    closeAll(menu);
    if (willOpen) {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    } else {
      closeMenu(trigger, menu);
    }
  });

  // Sélection d'un item (bouton) → ferme le menu après action.
  menu.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) {
      closeMenu(trigger, menu);
    }
  });
}
