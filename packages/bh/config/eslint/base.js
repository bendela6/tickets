import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import bhRules from './rules/index.js';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '.legacy/**',
      '**/*.config.{js,mjs,cjs,ts}',
      '**/eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      bh: bhRules,
    },
    rules: {
      'bh/multiline-arrow-needs-body': 'error',
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-invalid-void-type': [
        'error',
        { allowInGenericTypeArguments: true, allowAsThisParameter: true },
      ],
      '@typescript-eslint/no-empty-function': [
        'error',
        { allow: ['arrowFunctions', 'functions', 'methods'] },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value=/^\\.\\.?\\/.+\\.js$/]',
          message:
            '.js extension on a relative import is not allowed — use the extensionless form (moduleResolution: bundler resolves the .ts directly).',
        },
        {
          selector: 'ImportExpression[source.value=/^\\.\\.?\\/.+\\.js$/]',
          message:
            '.js extension on a relative dynamic import is not allowed — use the extensionless form.',
        },
        {
          selector: 'ExportAllDeclaration[source.value=/^\\.\\.?\\/.+\\.js$/]',
          message: '.js extension on a relative re-export is not allowed.',
        },
        {
          selector: 'ExportNamedDeclaration[source.value=/^\\.\\.?\\/.+\\.js$/]',
          message: '.js extension on a relative re-export is not allowed.',
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },
  prettier,
  {
    // Re-enable curly AFTER eslint-config-prettier, which defensively turns it
    // off. Prettier never adds/removes braces on control statements, so there
    // is no real conflict — we want braces on every if/else body (project rule).
    rules: {
      curly: ['error', 'all'],
    },
  },
];
