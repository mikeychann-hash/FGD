import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'desktop/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'desktop/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'desktop/renderer/index.html'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'desktop/renderer/src'),
    },
  },
});
