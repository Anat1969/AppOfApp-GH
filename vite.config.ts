import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  // Second page: the private payslip reader (tlush/), its data never leaves the browser.
  build: { rollupOptions: { input: { main: resolve(__dirname, 'index.html'), tlush: resolve(__dirname, 'tlush/index.html') } } },
  server: { port: 5173 },
  preview: { port: 4173 },
});
