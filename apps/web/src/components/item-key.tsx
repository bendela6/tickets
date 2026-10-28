import { cn } from '@tilewise/ui';

type ItemKeyProps = { itemKey: string; muted?: boolean; className?: string };

/** An item's key (`TIX-90`, `TK/E14`, `TK-80.3`) in the mono key style. */
export function ItemKey({ itemKey, muted, className }: ItemKeyProps) {
  return (
    <span
      className={cn(
        'font-mono text-12/17 font-500',
        muted ? 'text-gray-9' : 'text-gray-12',
        className,
      )}
    >
      {itemKey}
    </span>
  );
}
