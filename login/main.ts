import { login } from '../src/api';

const form = document.getElementById('loginForm') as HTMLFormElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const errorEl = document.getElementById('loginError') as HTMLElement;
const toggleButton = document.getElementById('togglePassword') as HTMLButtonElement;

toggleButton.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  toggleButton.textContent = isHidden ? '🙈' : '👁';
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
