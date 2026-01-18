import js from '@eslint/js';

export default [
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      'src/**/*.ts',
      'src/**/*.tsx'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    }
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script'
    }
  }
];

