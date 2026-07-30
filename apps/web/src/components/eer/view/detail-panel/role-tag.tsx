import { cn } from '@tickets/ui';

export function RoleTag({ role }: { role: 'pk' | 'fk' | null }) {
  if (!role)
    return <span className="inline-block w-7 shrink-0" aria-hidden />;
  return (
    <span
      className={cn('inline-block w-7 shrink-0 rounded-sm text-center font-mono text-9 font-600 leading-4', {
        // Same tinted-pill recipe as Badge: hue-9 at 15% behind hue-11 ink.
        // hue-9 on its own 15% tint is 3.72:1 (yellow) / 4.33:1 (green) at 9px;
        // step 11 takes them to 5.44:1 and 6.36:1.
        'bg-yellow-9/15 text-yellow-11': role === 'pk',
        'bg-green-9/15 text-green-11': role !== 'pk',
      })}
    >
      {role.toUpperCase()}
    </span>
  );
}
