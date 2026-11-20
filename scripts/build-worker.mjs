import { build } from 'esbuild';
await build({
  entryPoints: ['backend/worker.ts'], bundle: true, format: 'esm', platform: 'node',
  external: ['cloudflare:node', 'cloudflare:workers'],
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire("/index.js");' },
  outfile: 'dist/worker/index.js',
});
