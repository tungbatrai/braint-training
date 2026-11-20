import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['backend/**/*.test.{ts,tsx}', 'frontend/**/*.test.{ts,tsx}', 'shared/**/*.test.{ts,tsx}'] },
});
