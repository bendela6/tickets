import type { SettingsTabProps } from './types-tab';

// Placeholder — built out in Task 13 (link type list + create/edit + target-type chips).
export function LinksTab({ board }: SettingsTabProps) {
  return (
    <div className="px-6 py-5.5">
      <h2 className="m-0 font-sans text-[15px] font-semibold text-ink">Links</h2>
      <p className="mt-1.5 font-sans text-ui text-ink-3">
        {board.linkTypes.length} link type{board.linkTypes.length === 1 ? '' : 's'} in this scheme.
      </p>
    </div>
  );
}
