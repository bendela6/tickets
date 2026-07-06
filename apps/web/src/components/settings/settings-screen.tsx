import { useState } from 'react';
import type { Board } from '../../api/types';
import { cn } from '../../ui/cn';
import type { BoardIndexes } from '../../utils/index-board';
import { FieldsSettings } from './fields-settings';
import { LinkTypesSettings } from './link-types-settings';
import { TypesSettings } from './types-settings';
import { UsersSettings } from './users-settings';
import { WorkflowSettings } from './workflow-settings';

export type SettingsSectionProps = {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
};

type SectionKey = 'fields' | 'types' | 'workflow' | 'link-types' | 'users';

const PROJECT_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'fields', label: 'Fields' },
  { key: 'types', label: 'Types' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'link-types', label: 'Link types' },
];

// Settings shell per docs/design/06-settings-admin.html §A: a 212px secondary
// nav (PROJECT vocabulary sections, then WORKSPACE) beside the section content.
// The outer app sidebar comes from AppShell; this only renders the inner split.
export function SettingsScreen({ board, indexes, projectKey }: SettingsSectionProps) {
  const [section, setSection] = useState<SectionKey>('fields');

  const counts: Record<SectionKey, number> = {
    fields: board.fields.filter((field) => !field.archivedAt).length,
    types: board.types.filter((type) => !type.archivedAt).length,
    workflow: board.statuses.filter((status) => !status.archivedAt).length,
    'link-types': board.linkTypes.filter((linkType) => !linkType.archivedAt).length,
    users: board.users.filter((user) => !user.archivedAt).length,
  };

  function navItem({ key, label }: { key: SectionKey; label: string }) {
    const active = section === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setSection(key)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex h-7.5 shrink-0 cursor-pointer items-center gap-2 rounded-[7px] px-2.25 text-left font-sans text-ui',
          active ? 'bg-inset font-medium text-ink' : 'text-ink-2 hover:bg-inset hover:text-ink',
        )}
      >
        <span className="flex-1">{label}</span>
        <span className="font-mono text-[11px] text-ink-3">{counts[key]}</span>
      </button>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* settings secondary nav */}
      <nav
        aria-label="Settings sections"
        className="flex w-53 flex-none flex-col gap-0.5 overflow-y-auto border-r border-hairline bg-app px-3 py-5.5"
      >
        <h1 className="m-0 px-2.25 pb-3 font-sans text-[16px] font-semibold text-ink">
          Settings — {board.project.name}
        </h1>
        <div className="flex items-center gap-1.75 px-2.25 pb-2">
          <span className="font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">
            PROJECT
          </span>
          <span className="inline-flex h-5 items-center rounded-[5px] border border-hairline px-1.75 font-mono text-[11px] font-medium text-ink">
            {board.project.ticketPrefix}
          </span>
        </div>
        {PROJECT_SECTIONS.map(navItem)}
        <div className="px-2.25 pb-1.5 pt-4 font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">
          WORKSPACE
        </div>
        {navItem({ key: 'users', label: 'Users' })}
      </nav>

      {/* section content */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {section === 'fields' ? (
          <FieldsSettings board={board} indexes={indexes} projectKey={projectKey} />
        ) : section === 'types' ? (
          <TypesSettings board={board} indexes={indexes} projectKey={projectKey} />
        ) : section === 'workflow' ? (
          <WorkflowSettings board={board} indexes={indexes} projectKey={projectKey} />
        ) : section === 'link-types' ? (
          <LinkTypesSettings board={board} indexes={indexes} projectKey={projectKey} />
        ) : (
          <UsersSettings board={board} indexes={indexes} projectKey={projectKey} />
        )}
      </div>
    </div>
  );
}
