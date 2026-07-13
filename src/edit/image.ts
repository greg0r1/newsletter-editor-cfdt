/**
 * Compresse une image côté client avant upload. Réduit la largeur à `maxWidth`
 * puis réencode via canvas.
 *
 * Format de sortie : JPEG par défaut (meilleure compression pour les photos),
 * mais **PNG si l'image source contient de la transparence** — sinon le JPEG
 * aplatirait le fond transparent en noir (le canvas est transparent par
 * défaut, JPEG ne gère pas l'alpha). Indispensable pour les visuels détourés
 * (soleil, mégaphone…). Le reste de la chaîne d'upload (api.ts, upload-image.ts)
 * propage automatiquement `blob.type` : rien d'autre à adapter.
 */
export function compressImage(file: File, maxWidth = 560, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        // Détecte la transparence dans l'image redimensionnée : si au moins un
        // pixel a un alpha < 255, on encode en PNG pour la préserver. `quality`
        // est ignoré par le navigateur pour le PNG (sans perte), ce qui reste
        // acceptable pour des images ≤ maxWidth.
        const hasAlpha = imageHasTransparency(ctx, w, h);
        const mime = hasAlpha ? 'image/png' : 'image/jpeg';

        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Compression échouée'))),
          mime,
          quality,
        );
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Vrai si au moins un pixel du canvas a un canal alpha < 255. */
function imageHasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  // data est [r,g,b,a, r,g,b,a, …] : on ne teste que l'octet alpha (index 3 + 4k).
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}
