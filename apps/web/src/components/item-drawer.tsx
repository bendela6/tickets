import { useEffect } from 'react';
import type { Board, Item } from '../api/types';
import type { BoardIndexes } from '../utils/index-board';
import { ItemDetail } from './item-detail';

// Right-side peek panel over the board: scrim + fixed full-height drawer
// (620px from md up, full-screen sheet below md per the mobile design).
// Esc closes; the board behind stays mounted.
export function ItemDrawer({
  projectKey,
  board,
  indexes,
  item,
  onClose,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  item: Item;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside
        aria-label="Item detail"
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l-1 border-gray-6 bg-surface-raised font-sans text-gray-12 shadow-lg md:w-155 md:max-w-[calc(100vw-3rem)]"
      >
        {/* Keyed so switching items in-place resets edit drafts and tab state. */}
        <ItemDetail
          key={item.id}
          projectKey={projectKey}
          board={board}
          indexes={indexes}
          item={item}
          variant="drawer"
          onClose={onClose}
        />
      </aside>
    </>
  );
}
