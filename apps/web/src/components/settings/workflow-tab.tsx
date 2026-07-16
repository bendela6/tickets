import type { SettingsTabProps } from './types-tab';

// Placeholder — built out in Task 12 (workflow options + transition graph).
export function WorkflowTab({ board }: SettingsTabProps) {
  return (
    <div className="px-6 py-5.5">
      <h2 className="m-0 font-sans text-[15px] font-semibold text-ink">Workflow</h2>
      <p className="mt-1.5 font-sans text-ui text-ink-3">
        {board.options.length} option{board.options.length === 1 ? '' : 's'} across this scheme's option sets.
      </p>
    </div>
  );
}
