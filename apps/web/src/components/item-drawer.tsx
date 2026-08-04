import { Drawer } from '@tickets/ui';
import type { Board, Item } from '../api/types';
import type { BoardIndexes } from '../utils/index-board';
import { ItemDetail } from './item-detail';

// Right-side peek over the board. Esc, the scrim, the focus trap and the scroll
// lock all come from Drawer; the board behind stays mounted.
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
  return (
    <Drawer
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      side="right"
      size="lg"
      storageKey="item-drawer"
      maximizable
      label="Item detail"
    >
      {/* Keyed so switching items in-place resets edit drafts and tab state. */}
      <ItemDetail
        key={item.id}
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        item={item}
        variant="drawer"
      />
    </Drawer>
  );
}
