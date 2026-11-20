import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const bundle = await readFile(process.argv[2] || 'dist/worker/index.js', 'utf8');
const mf = new Miniflare({ workers: [{ config: {
  name: 'brain-training-test', compatibilityDate: '2026-11-09', compatibilityFlags: ['nodejs_compat'],
  manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundle } } },
  env: { DB: { type: 'd1', id: 'brain-training-test' }, APP_ORIGIN: { type: 'text', value: 'https://brain.test' } },
} }] });
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile('backend/schema.sql', 'utf8');
  await db.exec(schema);
  const health = await mf.dispatchFetch('https://worker.test/api/health');
  assert.equal(health.status, 200, await health.clone().text());
  const registration = await mf.dispatchFetch('https://worker.test/api/auth/register', {
    method: 'POST', headers: { origin: 'https://brain.test', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Kiểm thử', email: 'worker@example.test', password: 'password123' }),
  });
  assert.equal(registration.status, 201, await registration.clone().text());
  const row = await db.prepare('SELECT email FROM users WHERE email = ?').bind('worker@example.test').first();
  assert.equal(row?.email, 'worker@example.test');
  console.log('Worker/D1: kiểm tra health, đăng ký và dữ liệu đã lưu thành công.');
} finally { await mf.dispose(); }

