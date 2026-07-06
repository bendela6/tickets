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
        'inline-flex shrink-0 items-center justify-center font-semibold',
        kind === 'agent'
          ? 'rounded-md bg-accent-subtle font-mono text-accent'
          : 'rounded-full bg-opt-cyan-subtle font-sans text-opt-cyan',
        size === 'sm' ? 'size-4.5 text-[9px]' : 'size-5.5 text-[10px]',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
