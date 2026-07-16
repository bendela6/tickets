import type { Board } from '../../api/types';
import type { BoardIndexes } from '../../utils/index-board';

export type SettingsTabProps = {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
};

// Placeholder — built out in Task 10 (type list + create/edit + child-type chips).
export function TypesTab({ board }: SettingsTabProps) {
  return (
    <div className="px-6 py-5.5">
      <h2 className="m-0 font-sans text-[15px] font-semibold text-ink">Types</h2>
      <p className="mt-1.5 font-sans text-ui text-ink-3">
        {board.types.length} type{board.types.length === 1 ? '' : 's'} in this scheme.
      </p>
    </div>
  );
}
