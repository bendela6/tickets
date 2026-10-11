import { cn } from '../../../../../style/cn';

/**
 * The gutter cell. `select-none` so dragging across the document copies the document rather than
 * the ruler beside it.
 */
export function LineNumber({ line, tone }: { line: number; tone?: 'error' }) {
  return (
    <span
      aria-hidden={true}
      className={cn(
        'text-11/16 pr-2 pl-10 text-right font-mono tabular-nums select-none',
        tone === 'error' ? 'bg-red-3 text-red-11' : 'text-gray-8',
      )}
    >
      {line}
    </span>
  );
}
