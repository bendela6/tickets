import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  plugins: [require.resolve('prettier-plugin-tailwindcss')],
};
