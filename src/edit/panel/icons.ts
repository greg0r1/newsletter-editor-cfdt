/** Icône SVG inline (tracés style Lucide, colorés via currentColor). */
function icon(paths: string): string {
  return (
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

/** Icônes de la barre de formatage riche (mêmes conventions que `icon`). */
function ICON_B(kind: string): string {
  const p: Record<string, string> = {
    bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/>',
    italic: '<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>',
    underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/>',
    bullet: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
    ordered: '<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6.5 15.5A1 1 0 1 0 5 17c.7.4-1 1-1.5 1.5H6.5"/>',
    alignLeft: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>',
    alignCenter: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    color: '<path d="M12 3 4 21h3l1.5-4h7L18 21h3z"/><path d="M9.2 14h5.6"/>',
    clear: '<path d="M4 7h16"/><path d="m6 7 1 13h10l1-13"/><path d="m9 4 6 0"/><line x1="9" y1="11" x2="15" y2="17"/><line x1="15" y1="11" x2="9" y2="17"/>',
  };
  return icon(p[kind] ?? '');
}

export const ICONS = {
  close: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
  save: icon('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>'),
  image: icon(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>' +
      '<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  ),
  trash: icon(
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  ),
  up: icon('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
  down: icon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  minus: icon('<path d="M5 12h14"/>'),
  chevron: icon('<path d="m6 9 6 6 6-6"/>'),
  collapseAll: icon('<path d="m7 20 5-5 5 5"/><path d="m7 9 5-5 5 5"/>'),
  expandAll: icon('<path d="m7 15 5 5 5-5"/><path d="m7 4 5 5 5-5"/>'),
  type: icon('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
  text: icon('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/>'),
  star: icon('<path d="M12 3.5 14.5 9.4 21 10l-5 4.6L17.4 21 12 17.7 6.6 21 8 14.6 3 10l6.5-.6Z"/>'),
  move: icon('<path d="M12 2v20M2 12h20"/><path d="m5 9-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3"/>'),
};

/**
 * Boutons du mini-éditeur riche. La plupart sont de simples `document.execCommand`
 * (`cmd`), regroupés visuellement par `group`. Deux ont un comportement spécial
 * (`special`) traité à part : insertion de lien (prompt) et couleur (palette).
 */
type FormatButton =
  | { cmd: string; label: string; title: string; group: number }
  | { special: 'link' | 'color'; label: string; title: string; group: number };

export const FORMAT_BUTTONS: ReadonlyArray<FormatButton> = [
  { cmd: 'bold', label: ICON_B('bold'), title: 'Gras', group: 0 },
  { cmd: 'italic', label: ICON_B('italic'), title: 'Italique', group: 0 },
  { cmd: 'underline', label: ICON_B('underline'), title: 'Souligné', group: 0 },
  { cmd: 'insertUnorderedList', label: ICON_B('bullet'), title: 'Liste à puces', group: 1 },
  { cmd: 'insertOrderedList', label: ICON_B('ordered'), title: 'Liste numérotée', group: 1 },
  { cmd: 'justifyLeft', label: ICON_B('alignLeft'), title: 'Aligner à gauche', group: 2 },
  { cmd: 'justifyCenter', label: ICON_B('alignCenter'), title: 'Centrer', group: 2 },
  { special: 'link', label: ICON_B('link'), title: 'Insérer un lien', group: 3 },
  { special: 'color', label: ICON_B('color'), title: 'Couleur du texte', group: 3 },
  { cmd: 'removeFormat', label: ICON_B('clear'), title: 'Effacer le format', group: 4 },
];

/** Palette de couleurs proposée pour le texte (identité + neutres). */
export const TEXT_COLORS: ReadonlyArray<{ value: string; name: string }> = [
  { value: '#2f3640', name: 'Encre' },
  { value: '#4a5666', name: 'Gris' },
  { value: '#0b2c54', name: 'Bleu marine' },
  { value: '#e84e10', name: 'Orange CFDT' },
  { value: '#1f8a5b', name: 'Vert' },
  { value: '#c0392b', name: 'Rouge' },
];
