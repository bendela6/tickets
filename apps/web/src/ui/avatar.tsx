import { cn } from '@tickets/ui';

type AvatarProps = {
  name: string;
  kind: 'human' | 'agent';
  size?: 'sm' | 'md';
  className?: string;
};

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
          ? 'rounded-md bg-indigo-3 font-mono text-indigo-9'
          : 'rounded-full bg-cyan-3 font-sans text-cyan-9',
        size === 'sm' ? 'size-4.5 text-[9px]' : 'size-5.5 text-[10px]',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
