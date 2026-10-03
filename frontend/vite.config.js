import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In dev the API runs separately; in production Express serves this build, so /api is same-origin.
    proxy: { '/api': 'http://localhost:4000' },
  },
  test: { environment: 'node' },
});
