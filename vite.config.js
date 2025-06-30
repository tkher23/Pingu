import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // 🔥 This tells Vite: "Build this file, but output it as dist/popup.html"
        'popup': resolve(__dirname, 'popup.html'),
      },
      output: {
        assetFileNames: '[name][extname]',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      }
    }
  },
  publicDir: 'public',
});
