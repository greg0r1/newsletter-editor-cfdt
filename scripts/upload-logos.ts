/**
 * Upload one-shot des logos CFDT (PNG) vers Vercel Blob, pour usage dans
 * l'export email (les SVG de public/ ne sont pas des URLs publiques stables
 * utilisables dans un client mail). À rejouer seulement si les logos changent.
 *
 * Usage: node --import tsx scripts/upload-logos.ts
 * Nécessite BLOB_READ_WRITE_TOKEN en env (présent dans .env.local).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { put } from '@vercel/blob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '../public');

async function uploadLogo(file: string, blobPath: string): Promise<void> {
  const buffer = readFileSync(join(PUBLIC_DIR, file));
  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType: 'image/png',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  console.log(`  ${file} → ${blob.url}`);
}

async function main(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN manquant (charger .env.local).');
  }
  console.log('Upload des logos vers Vercel Blob…');
  await uploadLogo('cfdt-logo.png', 'logos/cfdt-logo.png');
  await uploadLogo('cfdt-logo-footer.png', 'logos/cfdt-logo-footer.png');
  console.log('Terminé. Copiez les URLs ci-dessus dans src/api/exportEmail.ts.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
