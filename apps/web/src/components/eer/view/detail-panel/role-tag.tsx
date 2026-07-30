import { cn } from '@tickets/ui';

export function RoleTag({ role }: { role: 'pk' | 'fk' | null }) {
  if (!role)
    return <span className="inline-block w-7 shrink-0" aria-hidden />;
  return (
    <span
      className={cn('inline-block w-7 shrink-0 rounded-sm text-center font-mono text-9 font-600 leading-4', {
        'bg-yellow-9/15 text-yellow-9': role === 'pk',
        'bg-green-9/15 text-green-9': role !== 'pk',
      })}
    >
      {role.toUpperCase()}
    </span>
  );
}
