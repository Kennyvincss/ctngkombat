import { defineConfig } from 'vite';

// Relative base so dist/ works from any path (GitHub Pages, Vercel, Netlify, a sub-folder).
export default defineConfig({
  base: './',
  // online players must run the same build (the fight simulation must match exactly)
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
