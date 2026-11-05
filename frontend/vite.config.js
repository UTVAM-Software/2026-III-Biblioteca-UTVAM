import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, todo lo que empiece con /api se manda al servidor PHP (puerto 8000).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
