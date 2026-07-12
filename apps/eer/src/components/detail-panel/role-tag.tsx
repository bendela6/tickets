import type { Entity } from '../../engine/model/types';
import { cn } from '../../ui/cn';

export function RoleTag({ role }: { role: Entity['fields'][number]['role'] }) {
  if (!role)
    return <span className="inline-block w-7 shrink-0" aria-hidden />;
  return (
    <span
      className={cn(
        'inline-block w-7 shrink-0 rounded text-center font-mono text-3xs font-semibold leading-4',
        role === 'pk' ? 'bg-pk/15 text-pk' : 'bg-fk/15 text-fk',
      )}
    >
      {role.toUpperCase()}
    </span>
  );
}
