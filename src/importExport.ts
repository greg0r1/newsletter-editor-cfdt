import type { Newsletter } from './state';

export function exportJSON(newsletter: Newsletter): void {
  const blob = new Blob([JSON.stringify(newsletter, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `newsletter-cfdt-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isNewsletter(value: unknown): value is Newsletter {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.mast === 'object' &&
    typeof v.edito === 'object' &&
    Array.isArray(v.articles) &&
    typeof v.infoBox === 'object' &&
    typeof v.summerBox === 'object'
  );
}

export function importJSON(file: File): Promise<Newsletter> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!isNewsletter(data)) {
          reject(new Error('Fichier invalide : structure de newsletter inattendue.'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('Fichier invalide : impossible de lire ce fichier JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsText(file);
  });
}
