import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    // `vercel dev` assigne un port aléatoire à la Dev Command via $PORT et
    // attend qu'elle écoute exactement dessus (sinon timeout de 5 min).
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login/index.html'),
        config: resolve(__dirname, 'config/index.html'),
      },
    },
  },
});
