import { defineConfig } from 'vite';

// Relative base so dist/ works from any path (GitHub Pages, Vercel, Netlify, a sub-folder).
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
