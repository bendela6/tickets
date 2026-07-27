// A small reusable tablist — generic over the caller's tab id union, no
// domain knowledge of what a "column"/"constraint"/"index" is. It only ever
// renders the `role="tablist"` header row; the caller renders its own
// `role="tabpanel"` for whichever tab is active (see table-modal.tsx) so
// switching tabs never has to move — let alone reset — the caller's own
// draft state (that state staying in the PARENT is exactly what keeps a tab
// switch from ever losing unsaved edits).
//
// Each tab shows a mono `count`; `hasError` only swaps that count's color to
// red so a validation problem on an INACTIVE tab is still visible without
// clicking through to it — this component has no opinion on what "count"
// MEANS (item count normally, error count when `hasError`), that's entirely
// the caller's call (see table-modal.tsx).

import { cn } from '@tickets/ui';

export interface TabItem<Id extends string> {
  id: Id;
  label: string;
  count: number;
  hasError?: boolean;
}

export interface TabsProps<Id extends string> {
  tabs: TabItem<Id>[];
  activeId: Id;
  onSelect: (id: Id) => void;
  // Namespaces the generated DOM ids so more than one <Tabs/> can exist on a
  // page without their tab/tabpanel id pairs colliding.
  idBase: string;
}

export function tabButtonId(idBase: string, id: string): string {
  return `${idBase}-tab-${id}`;
}

export function tabPanelId(idBase: string, id: string): string {
  return `${idBase}-tabpanel-${id}`;
}

const tabBtn = cn(
  'flex items-center gap-2 border-b-2 border-transparent px-1 pb-2',
  'text-sm text-gray-400 hover:text-gray-200',
);
const tabBtnActive = 'border-blue-400 text-gray-50 hover:text-gray-50';
const count = 'rounded bg-gray-800 px-2 py-px font-mono text-2xs text-gray-300';
const countError = 'rounded bg-red-950 px-2 py-px font-mono text-2xs text-red-400';

export function Tabs<Id extends string>({ tabs, activeId, onSelect, idBase }: TabsProps<Id>) {
  return (
    <div role="tablist" className="flex gap-4 border-b border-gray-600">
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabButtonId(idBase, t.id)}
            aria-selected={active}
            aria-controls={tabPanelId(idBase, t.id)}
            className={cn(tabBtn, active && tabBtnActive)}
            onClick={() => onSelect(t.id)}
          >
            <span>{t.label}</span>
            <span className={t.hasError ? countError : count}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}
