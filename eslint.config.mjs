import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';
import globals from 'globals';

export default [
  { ignores: ['.next/**', 'node_modules/**', 'ui-screenshots/**', 'data/**'] },
  js.configs.recommended,
  { plugins: { '@next/next': next } },
  { files: ['**/*.mjs', '**/*.cjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.node, ...globals.browser } },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': hooks },
    rules: {
      // TypeScript owns symbol resolution and unused bindings in typed sources.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
    },
  },
];
