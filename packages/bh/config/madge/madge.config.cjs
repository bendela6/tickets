module.exports = {
  fileExtensions: ['ts', 'tsx'],
  tsConfig: './tsconfig.json',
  // Matched against each file's path from the target, so a folder is matched
  // as a whole segment: /dist/ alone also skipped src/distance.ts.
  excludeRegExp: [/\.d\.ts$/, /(^|\/)node_modules\//, /(^|\/)dist\//, /(^|\/)\.legacy\//],
  detectiveOptions: {
    ts: { skipTypeImports: true },
    tsx: { skipTypeImports: true },
  },
};
