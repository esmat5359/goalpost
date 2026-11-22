import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Some browser builds of Ethereum tooling still reference the Node global.
  define: { global: 'globalThis' },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // React and the router change rarely, so they get their own long-lived chunk. genlayer-js and
        // viem are only ever imported dynamically (see src/lib/chain.ts) and form their own chunk.
        manualChunks(id: string): string | undefined {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173 },
});
