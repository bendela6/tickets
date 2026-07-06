import { cn } from './cn';

type AvatarProps = { name: string; kind: 'human' | 'agent'; size?: 'sm' | 'md'; className?: string };

function initials(name: string) {
  const parts = name.trim().split(/[\s-]+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ name, kind, size = 'sm', className }: AvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center border border-hairline bg-inset font-sans font-medium text-ink-2',
        kind === 'agent' ? 'rounded-[4px]' : 'rounded-full',
        size === 'sm' ? 'size-5 text-[9px]' : 'size-7 text-meta',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
