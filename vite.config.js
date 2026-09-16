import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  define: {
    // Make process.env accessible (needed by some crypto libs)
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Point to the npm buffer polyfill, not the Node built-in
      buffer: path.resolve(__dirname, 'node_modules/buffer/index.js'),
    },
  },
  optimizeDeps: {
    include: ['buffer'],
    // Anchor and SPL-token are large CJS/ESM hybrid packages — excluding them
    // from pre-bundling prevents the "new dependencies optimized → reload → white page" crash.
    // They are dynamically imported in contractService.js so they never block startup.
    exclude: ['@coral-xyz/anchor', '@solana/spl-token'],
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendors into separate cached chunks so a code change only
        // invalidates the page chunk — not React, Firebase, or charts.
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3') || id.includes('node_modules/victory')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/@solana/web3.js') || id.includes('node_modules/@solana/buffer-layout')) {
            return 'vendor-solana';
          }
          if (id.includes('node_modules/bip39') || id.includes('node_modules/@scure') || id.includes('node_modules/@noble')) {
            return 'vendor-crypto';
          }
        },
      },
    },
  },
});
