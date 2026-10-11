import globals from 'globals';
import base from './base.js';

export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    // One rule, and not no-restricted-syntax: it covers `process.env`,
    // `process['env']` and `const { env } = process`, and flat config would
    // replace base's no-restricted-syntax (its ban on `.js` relative imports)
    // wholesale.
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read env via ./environment.ts, not process.env directly.',
        },
      ],
    },
  },
  {
    // The only file allowed to read process.env directly.
    files: ['**/environment.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
];
