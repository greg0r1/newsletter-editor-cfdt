/**
 * Modale d'aide : documentation statique de l'application, consultable à
 * tout moment sans jamais s'ouvrir automatiquement (ne doit pas interrompre
 * l'édition en cours). Même pattern que imagePicker.ts/emailPreview.ts :
 * overlay construit une seule fois puis réutilisé.
 */

import { registerModal, closeOtherModals } from './modal';

// Doit rester synchronisé avec SESSION_MAX_AGE_SECONDS (api/_lib/auth.ts) —
// non importable ici : ce module est backend-only (jamais bundlé au front).
const SESSION_MAX_AGE_DAYS = 30;

interface HelpSection {
  title: string;
  body: string;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Connexion et session',
    body:
      `<p>L'accès se fait avec un <strong>mot de passe unique, partagé</strong> entre les personnes qui éditent la newsletter.</p>` +
      `<p>Une fois connecté, la session reste active <strong>${SESSION_MAX_AGE_DAYS} jours à partir de la connexion</strong> — elle n'est pas prolongée automatiquement par l'utilisation. Passé ce délai, vous êtes redirigé vers l'écran de connexion, puis ramené directement à la page où vous étiez une fois reconnecté.</p>` +
      `<p>Se reconnecter ne fait perdre aucune donnée déjà enregistrée.</p>`,
  },
  {
    title: 'Éditer le texte',
    body:
      `<p>Cliquez sur un article ou un bloc de la feuille pour ouvrir le panneau d'édition, sur le côté.</p>` +
      `<p>Modifiez le texte directement dans ce panneau, puis cliquez sur <strong>« Enregistrer »</strong> pour valider vos changements. Le badge en haut de la page confirme l'enregistrement : « Sauvegarde… » puis « Enregistré ».</p>` +
      `<p>Tant que « Enregistrer » n'a pas été cliqué, les modifications restent dans le panneau et ne sont pas envoyées au serveur.</p>` +
      `<p>Ce même badge affiche aussi <strong>« Chargement… »</strong> puis <strong>« Chargé »</strong> à l'ouverture de la page : il indique alors que la newsletter a bien été récupérée depuis le serveur, avant toute modification.</p>`,
  },
  {
    title: 'Images',
    body:
      `<p>Cliquez sur une image pour la remplacer. Vous pouvez choisir une image déjà utilisée dans la galerie, ou en importer une nouvelle (elle sera automatiquement compressée).</p>`,
  },
  {
    title: 'Articles',
    body:
      `<p>Le bouton <strong>+ Article</strong> en ajoute un nouveau.</p>` +
      `<p>Ouvrir un article donne accès au panneau latéral, qui permet de le supprimer ou de le réorganiser.</p>`,
  },
  {
    title: 'Exporter / Imprimer',
    body:
      `<ul>` +
      `<li><strong>Export JSON</strong> — une sauvegarde de secours téléchargeable, qui peut être réimportée plus tard.</li>` +
      `<li><strong>Export email</strong> — un aperçu et un fichier HTML prêt à coller dans un envoi.</li>` +
      `<li><strong>Imprimer / PDF</strong> — utilise l'impression du navigateur ; la mise en page A4 est automatique.</li>` +
      `</ul>`,
  },
  {
    title: 'Importer',
    body:
      `<p>Remplace <strong>tout</strong> le contenu actuellement affiché par celui du fichier JSON choisi. Il est recommandé de faire un export récent avant d'importer, au cas où.</p>`,
  },
  {
    title: 'Réinitialiser',
    body:
      `<p>Action <strong>irréversible</strong> : elle revient au contenu actuellement enregistré côté serveur et efface les modifications non enregistrées à l'écran. Une confirmation est demandée avant d'agir.</p>`,
  },
  {
    title: 'Déconnexion',
    body:
      `<p>Ferme la session immédiatement. Il faudra ressaisir le mot de passe à la prochaine visite.</p>`,
  },
];

let overlay: HTMLElement | null = null;

function icon(paths: string): string {
  return (
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

function sectionsHTML(): string {
  return HELP_SECTIONS.map(
    (s) =>
      `<section class="help-section">` +
      `<h3 class="help-section-title">${s.title}</h3>` +
      `<div class="help-section-body">${s.body}</div>` +
      `</section>`,
  ).join('');
}

function build(): void {
  overlay = document.createElement('div');
  overlay.className = 'help-modal no-print';
  overlay.hidden = true;
  overlay.innerHTML =
    `<div class="help-scrim" data-close></div>` +
    `<div class="help-card" role="dialog" aria-modal="true" aria-label="Aide">` +
    `<header class="help-head">` +
    `<span class="help-title">Aide</span>` +
    `<button type="button" class="help-close" data-close aria-label="Fermer">` +
    icon('<path d="M18 6 6 18M6 6l12 12"/>') +
    `</button>` +
    `</header>` +
    `<div class="help-body">${sectionsHTML()}</div>` +
    `</div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-close]')) close();
  });

  registerModal({ overlay, close });
}

function close(): void {
  if (overlay) overlay.hidden = true;
}

export function openHelp(): void {
  if (!overlay) build();
  if (!overlay) return;
  closeOtherModals(overlay);
  overlay.hidden = false;
}
