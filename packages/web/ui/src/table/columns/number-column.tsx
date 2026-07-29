import type { Renderer } from '@tickets/table';

type NumberColumnOpts = {
  format?: 'integer' | 'decimal' | 'currency';
  currency?: string;
  fractionDigits?: number;
};

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

/** `tabular-nums` is what makes a numeric column readable — proportional
 *  digits make the ones and sevens wander out of alignment down the column. */
export function NumberColumn(opts: NumberColumnOpts = {}): Renderer<number | string | null> {
  const { format: style = 'decimal', currency, fractionDigits } = opts;
  return ({ value }) => {
    if (value == null || value === '') return <span className="text-gray-9">—</span>;
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return <span className="text-gray-9">—</span>;
    return (
      <span className="block text-right font-mono text-12/17 tabular-nums">
        {format(n, style, currency, fractionDigits)}
      </span>
    );
  };
}
