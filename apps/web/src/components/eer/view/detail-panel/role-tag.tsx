import { cn } from '@tickets/ui';

export function RoleTag({ role }: { role: 'pk' | 'fk' | null }) {
  if (!role)
    return <span className="inline-block w-7 shrink-0" aria-hidden />;
  return (
    <span
      className={cn('inline-block w-7 shrink-0 rounded text-center font-mono text-3xs font-semibold leading-4', {
        'bg-yellow-400/15 text-yellow-400': role === 'pk',
        'bg-green-400/15 text-green-400': role !== 'pk',
      })}
    >
      {role.toUpperCase()}
    </span>
  );
}
