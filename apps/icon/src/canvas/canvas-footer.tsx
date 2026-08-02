import { Tabs, cn } from '@tickets/ui';
import { selectedObject, type EditorState } from '../doc/store';
import { safeZoneWarnings } from '../doc/validate';
import { useEditor } from '../editor-context';
import type { Ground } from '../doc/types';

const GROUNDS: { value: Ground; label: string }[] = [
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
];

/**
 * The modifiers are only worth naming while a drag is actually under way —
 * printed permanently they would be chrome nobody reads, and there is no menu
 * or tooltip anywhere else that could teach them.
 */
const DRAG_HINT = 'hold ⇧ to constrain · ⌥ to duplicate';

/** A checkbox drawn as a small filled square, matching the design's chips. */
function ToggleChip({
  on,
  label,
  title,
  onToggle,
}: {
  on: boolean;
  label: string;
  title?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onToggle}
      className="flex h-6.5 items-center gap-1.75 rounded-md px-2.25 text-gray-9 hover:bg-surface-inset hover:text-gray-11"
    >
      <span
        aria-hidden
        className={cn(
          'size-2.75 flex-none rounded-sm border-2',
          on ? 'border-gray-11 bg-gray-11' : 'border-current bg-transparent',
        )}
      />
      <span className="font-mono text-11">{label}</span>
    </button>
  );
}

/**
 * The strip along the bottom of the canvas field.
 *
 * Bottom-left is how you are *looking* at the document — the grid and the
 * previewed ground — neither of which is a property of it. Bottom-right is one
 * slot that holds either a platform warning or the status line, never both:
 * the warning is contextual, not permanent chrome.
 */
/**
 * What the status slot says about the selection.
 *
 * One object is worth naming — you selected that shape, and the name is what
 * the rail calls it. Several are a count: naming them would print a list as
 * wide as the canvas to say something the accented rows already show.
 */
function selectionLine(state: EditorState): string {
  const one = selectedObject(state);
  if (one) return `${one.name} selected`;
  const count = state.selectedIds.size;
  return count === 0 ? 'nothing selected' : `${count} objects selected`;
}

export function CanvasFooter({ status }: { status: string }) {
  const { state, view, setView, dispatch } = useEditor();
  const warnings = safeZoneWarnings(state.doc);
  const showWarning = warnings.length > 0 && !view.dragging;
  const first = warnings[0];
  // Precedence: what is happening right now, then what an action just did,
  // then what is selected. A drag hint outlives its usefulness the moment the
  // pointer comes up, which is why it is not the fallback.
  const line = view.dragging ? DRAG_HINT : status || selectionLine(state);

  return (
    <>
      <div
        className={cn(
          'absolute bottom-3.25 left-3.5 flex items-center gap-2',
          view.dragging && 'opacity-40',
        )}
      >
        <ToggleChip
          on={view.grid}
          label="grid"
          onToggle={() => setView((v) => ({ ...v, grid: !v.grid }))}
        />
        <div className="flex h-6.5 items-center gap-1.75 rounded-md pl-2.25">
          <span className="font-mono text-11 text-gray-9">ground</span>
          <Tabs
            role="group"
            variant="segment"
            size="sm"
            label="Previewed ground"
            items={GROUNDS.map((g) => ({ value: g.value, label: g.label }))}
            value={view.ground}
            onChange={(value) => setView((v) => ({ ...v, ground: value as Ground }))}
          />
        </div>
      </div>

      {/* This slot stays fully lit while the rest of the chrome recedes: it is
          the one thing that has something new to say during a drag, and dimming
          it would hide exactly the modifiers it exists to teach. */}
      <div className="absolute bottom-3.5 right-4 flex items-center gap-2.5">
        {showWarning && first ? (
          <button
            type="button"
            title="Show the maskable safe zone"
            onClick={() => {
              dispatch({ type: 'selectObject', id: first.id });
              setView((v) => ({ ...v, safeZoneOpen: true }));
            }}
            className="flex h-5.5 items-center gap-1.5 rounded-md border-1 border-red-9 px-2 font-mono text-10 text-red-9"
          >
            <span
              aria-hidden
              className="flex size-3.25 flex-none items-center justify-center rounded-full border-1 border-current font-sans text-9 font-600"
            >
              !
            </span>
            {warnings.length === 1 ? '1 platform warning' : `${warnings.length} platform warnings`}
          </button>
        ) : (
          <span role="status" className="font-mono text-10 text-gray-9">
            {line}
          </span>
        )}
      </div>
    </>
  );
}
