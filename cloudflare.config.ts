import { bindings, defineConfig } from 'cf/config';

export default defineConfig(({ mode }) => {
  const originList = (process.env.APP_ORIGIN ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (mode === 'worker' && (!originList.length || originList.some((value) => {
    try { const url = new URL(value); return url.protocol !== 'https:' || url.origin !== value; }
    catch { return true; }
  }))) throw new Error('APP_ORIGIN cần chứa các origin HTTPS thực tế, phân cách bằng dấu phẩy.');
  return {
    worker: {
      name: 'brain-training-api',
      entrypoint: './backend/worker.ts',
      compatibilityDate: '2026-11-09',
      compatibilityFlags: ['nodejs_compat'],
      previewUrls: false,
      env: {
        DB: bindings.d1({ name: 'brain-training' }),
        APP_ORIGIN: bindings.text(originList.join(',')),
      },
      observability: { enabled: true, logs: { enabled: true }, traces: { enabled: true } },
    },
  };
});
