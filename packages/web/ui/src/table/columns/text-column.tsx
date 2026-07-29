import type { Renderer } from '@tickets/table';
import { cn } from '../../style';

type TextColumnOpts = { mono?: boolean; truncate?: boolean };

export function TextColumn(opts: TextColumnOpts = {}): Renderer<string | null | undefined> {
  const { mono, truncate = true } = opts;
  return ({ value }) => {
    if (value == null) return null;
    return (
      <span className={cn('block', truncate && 'truncate', mono && 'font-mono text-12/17')}>
        {value}
      </span>
    );
  };
}
