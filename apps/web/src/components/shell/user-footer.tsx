import { cn } from '@bh/ui';
import { ActorMenu } from './actor-menu';

/**
 * Who edits are attributed to, above the theme in the sidebar's footer: the
 * user card with its menu, or at rail width the avatar alone, the same menu
 * behind it.
 */
export function UserFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'border-gray-6 flex shrink-0 border-t-1',
        collapsed ? 'justify-center px-6 py-6' : 'px-12 py-8',
      )}
    >
      <ActorMenu compact={collapsed} />
    </div>
  );
}
