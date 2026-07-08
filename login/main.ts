import { login } from '../src/api';

const form = document.getElementById('loginForm') as HTMLFormElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const errorEl = document.getElementById('loginError') as HTMLElement;

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
