import { login } from '../src/api/api';

const form = document.getElementById('loginForm') as HTMLFormElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const errorEl = document.getElementById('loginError') as HTMLElement;
const toggleButton = document.getElementById('togglePassword') as HTMLButtonElement;

const EYE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/>' +
  '<path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/></svg>';

toggleButton.innerHTML = EYE_SVG;
toggleButton.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  toggleButton.innerHTML = isHidden ? EYE_OFF_SVG : EYE_SVG;
  toggleButton.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  try {
    await login(passwordInput.value);
    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get('redirect') || '/';
  } catch {
    errorEl.textContent = 'Mot de passe incorrect.';
  }
});
