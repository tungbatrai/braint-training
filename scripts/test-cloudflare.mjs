import { spawnSync } from 'node:child_process';
const build = spawnSync(process.execPath, ['node_modules/cf/bin/cf', 'build', '--mode', 'worker'], {
  stdio: 'inherit', env: { ...process.env, APP_ORIGIN: 'https://brain.test' },
});
if (build.status !== 0) process.exit(build.status ?? 1);
const smoke = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/worker-smoke.ts', '.cloudflare/output/v0/workers/default/bundle/index.js'], { stdio: 'inherit' });
process.exit(smoke.status ?? 1);
