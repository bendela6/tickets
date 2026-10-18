import { Fragment, type ReactNode } from 'react';
import { isAddress, type Shown } from '@bh/template';

// What bh's renderers share.

/** The values' text, joined by ', '. */
export function joined(values: readonly Shown[]): string {
  return values.map((shown) => shown.text).join(', ');
}

/** One value's own tone. None for several. */
export function ownTone(values: readonly Shown[]): string | undefined {
  return values.length === 1 ? values[0]?.tone : undefined;
}

/** Each value drawn, side by side, wrapping. */
export function Each({
  values,
  draw,
}: {
  values: readonly Shown[];
  draw: (shown: Shown) => ReactNode;
}) {
  const [only] = values;
  if (values.length === 1 && only) {
    return draw(only);
  }
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-4">
      {values.map((shown, index) => {
        return <Fragment key={index}>{draw(shown)}</Fragment>;
      })}
    </span>
  );
}

/** The value as a safe address, or undefined. */
export function hrefOf(value: Shown['value']): string | undefined {
  return typeof value === 'string' && isAddress(value) ? value : undefined;
}

/** The value as a number, or undefined. */
export function numberOf(shown: Shown): number | undefined {
  return typeof shown.value === 'number' && Number.isFinite(shown.value) ? shown.value : undefined;
}
