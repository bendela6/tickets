import type { SettingsTabProps } from './types-tab';

// Placeholder — built out in Task 11 (per-type placement editor).
export function FieldsTab({ board }: SettingsTabProps) {
  return (
    <div className="px-6 py-5.5">
      <h2 className="m-0 font-sans text-[15px] font-semibold text-ink">Fields</h2>
      <p className="mt-1.5 font-sans text-ui text-ink-3">
        {board.fields.length} field{board.fields.length === 1 ? '' : 's'} in this scheme.
      </p>
    </div>
  );
}
