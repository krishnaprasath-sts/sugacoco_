import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    // Also listen on the network address so other office PCs and phones can open the dev app.
    host: true,
    // Dev: /api calls go to the Express server.
    proxy: { '/api': 'http://localhost:5050' },
  },
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: cached by the browser across app updates.
        // MUI stays in one chunk on purpose: splitting it per page was measured slower on phones
        // (35–45 requests instead of ~24, and a longer download waterfall).
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'mui', test: /node_modules[\\/](@mui|@emotion)[\\/]/ },
            { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/ },
          ],
        },
      },
    },
  },
});
