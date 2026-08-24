import { resolve } from 'path';
import { defineConfig } from 'vite';
import { htmlIncludesPlugin } from './scripts/htmlIncludesPlugin.js';

export default defineConfig({
  root: './',
  base: './',
  plugins: [htmlIncludesPlugin()],
  server: {
    port: 5173,
    open: false,
    cors: true
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
        credits: resolve(__dirname, 'credits/index.html'),
        mission: resolve(__dirname, 'mission/index.html'),
        skills: resolve(__dirname, 'skills/index.html'),
        howItWorks: resolve(__dirname, 'how-it-works/index.html'),
        faq: resolve(__dirname, 'faq/index.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('curatedPrompts')) {
            return 'curated-prompts';
          }
          if (id.includes('curatedSkills')) {
            return 'curated-skills';
          }
          if (id.includes('node_modules/jszip')) {
            return 'vendor-jszip';
          }
          if (id.includes('node_modules/marked')) {
            return 'vendor-marked';
          }
          if (id.includes('node_modules/prismjs')) {
            return 'vendor-prism';
          }
        }
      }
    }
  }
});
