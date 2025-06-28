import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'src/popup.html') // Output dist/popup.html
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  publicDir: 'public',
});
