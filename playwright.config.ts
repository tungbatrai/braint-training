import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', actionTimeout: 10000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 120000, env: { DB_PATH: '.data/e2e.sqlite', APP_ORIGIN: 'http://127.0.0.1:5174', PORT: '8788', VITE_PORT: '5174', VITE_API_PROXY: 'http://127.0.0.1:8788' } },
});
