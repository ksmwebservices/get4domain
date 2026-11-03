// Minimal ESLint flat config (ESLint 9). Deliberately light: the goal of Step 0 is a CI signal that catches real mistakes
// without rewriting 500+ existing files. Tighten rule by rule in later phases.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'prisma/**', 'scripts/**', 'remotion/**', 'uploads/**', '**/*.js', '**/*.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['{src,test}/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': 'off',
      // The upload / theme / abuse sanitisers intentionally match control and unusual characters. Do not rewrite
      // security regexes to satisfy lint; revisit rule by rule with tests in place.
      'no-control-regex': 'off',
      'no-misleading-character-class': 'off',
      'no-irregular-whitespace': 'warn',
      'no-useless-escape': 'warn',
    },
  },
);
