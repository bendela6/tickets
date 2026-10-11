import type { Renderer } from '@bh/table';

interface NumberColumnOpts {
  /** How the number is written: whole, with decimals as it has them, or as money. `decimal` by default. */
  format?: 'integer' | 'decimal' | 'currency';
  /** The ISO currency code `currency` writes in, such as `EUR`; without one, it writes a decimal. */
  currency?: string;
  /** The digits after the point: exactly this many as money (2 by default), at least this many as a decimal. */
  fractionDigits?: number;
}

function format(
  n: number,
  style: 'integer' | 'decimal' | 'currency',
  currency: string | undefined,
  fractionDigits: number | undefined,
): string {
  if (style === 'currency' && currency) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits ?? 2,
      maximumFractionDigits: fractionDigits ?? 2,
    }).format(n);
  }
  if (style === 'integer') {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 6,
  }).format(n);
}

/**
 * A cell of a number, right-aligned in the mono face with digits of one
 * width, in the reader's locale. A missing or unreadable value is a dash.
 */
// `tabular-nums` is what makes a numeric column readable — proportional
// digits make the ones and sevens wander out of alignment down the column.
export function NumberColumn(opts: NumberColumnOpts = {}): Renderer<number | string | null> {
  const { format: style = 'decimal', currency, fractionDigits } = opts;
  return ({ value }) => {
    // `.trim()` matters: `Number('  ')` is 0, not NaN, so a whitespace-only
    // cell would otherwise render a fake zero instead of an em dash — wrong
    // data, not just wrong styling.
    if (value == null || (typeof value === 'string' && value.trim() === '')) {
      return <span className="text-gray-9">—</span>;
    }
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) {
      return <span className="text-gray-9">—</span>;
    }
    return (
      <span className="text-12/17 block text-right font-mono tabular-nums">
        {format(n, style, currency, fractionDigits)}
      </span>
    );
  };
}
