/**
 * `--color-<name>: var(--ins-<name>);` for every colour-typed token.
 *
 * This is the bridge into Tailwind's palette namespace: declaring
 * `--color-gray-1` is what makes `bg-gray-1` / `text-gray-1` compile. The
 * indirection through `--ins-*` is what lets one bridge line serve both themes,
 * since the `--ins-*` value is the thing that changes under `[data-theme]`.
 */
export function colorVarLines(names: string[], indent = '  '): string {
  return names.map((name) => `${indent}--color-${name}: var(--ins-${name});\n`).join('');
}
