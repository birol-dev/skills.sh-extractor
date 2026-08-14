import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: './',
  server: {
    port: 5173,
    open: false,
    cors: true
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsInlineLimit: 100000000, // Inline WASM and assets
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});
