import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['node_modules/**', '.cloudflare/**', 'dist/**', 'artifacts/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx}'], plugins: { 'react-hooks': reactHooks }, rules: { ...reactHooks.configs.recommended.rules } },
  { files: ['**/*.{js,mjs,ts,tsx}'], languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', Request: 'readonly', Response: 'readonly', Headers: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', crypto: 'readonly', document: 'readonly', window: 'readonly', localStorage: 'readonly', navigator: 'readonly' } } },
);

