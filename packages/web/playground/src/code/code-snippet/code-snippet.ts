import type { AnyControlDef } from '@tickets/ui';

function fmt(v: unknown): string {
  if (typeof v === 'string') return `"${v.replace(/"/g, '\\"')}"`;
  return `{${String(v)}}`;
}

// Generate the JSX for the current control values. Omits props at their
// initial/undefined values; `true` renders as a bare flag; the `children`
// control renders as element children; >3 set props wrap one-per-line.
export function generateSnippet(
  component: string,
  controls: Record<string, AnyControlDef>,
  values: Record<string, unknown>,
): { code: string; omitted: string[] } {
  const omitted: string[] = [];
  const props: string[] = [];
  let children = '';
  for (const [key, def] of Object.entries(controls)) {
    const v = values[key];
    if (key === 'children') {
      children = typeof v === 'string' ? v : '';
      continue;
    }
    if (v === undefined || v === def.initial) {
      omitted.push(key);
      continue;
    }
    props.push(v === true ? key : `${key}=${fmt(v)}`);
  }
  const open =
    props.length > 3
      ? `<${component}\n  ${props.join('\n  ')}\n>`
      : props.length > 0
        ? `<${component} ${props.join(' ')}>`
        : `<${component}>`;
  const code = children
    ? `${open}${props.length > 3 ? '\n  ' : ''}${children}${props.length > 3 ? '\n' : ''}</${component}>`
    : `${open.replace(/>$/, ' />')}`;
  return { code, omitted };
}
