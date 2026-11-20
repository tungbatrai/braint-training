import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  if (mode === 'worker') return { plugins: [cloudflare()] };
  return {
    root: resolve(import.meta.dirname, 'frontend'),
    plugins: [react()],
    server: {
      host: '127.0.0.1', port: Number(process.env.VITE_PORT || 5173), strictPort: true,
      proxy: { '/api': process.env.VITE_API_PROXY || 'http://127.0.0.1:8787' },
    },
    build: { outDir: resolve(import.meta.dirname, 'dist/client'), emptyOutDir: true },
  };
});
