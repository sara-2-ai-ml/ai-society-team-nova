import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The browser calls /api on the same origin; Vite forwards it to the NestJS backend.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
