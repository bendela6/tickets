import type { CSSProperties } from 'react';

type RuntimeVariables = Partial<Record<`--${string}`, string | number>>;

export function runtimeStyle(variables: RuntimeVariables): CSSProperties {
  return variables as CSSProperties;
}
