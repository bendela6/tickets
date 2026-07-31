import { Tabs, cn } from '@tickets/ui';
import { selectedObject } from '../doc/store';
import { safeZoneWarnings } from '../doc/validate';
import { useEditor } from '../editor-context';
import type { Ground } from '../doc/types';

const GROUNDS: { value: Ground; label: string }[] = [
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
];

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
 * Bottom-left is how you are *looking* at the document — grid, motion,
 * previewed ground — none of which is a property of it. Bottom-right is one
 * slot that holds either a platform warning or the status line, never both:
 * the warning is contextual, not permanent chrome.
 */
export function CanvasFooter({ status }: { status: string }) {
  const { state, view, setView, dispatch } = useEditor();
  const warnings = safeZoneWarnings(state.doc);
  const selected = selectedObject(state);
  const busy = view.dragging || view.playing;
  const showWarning = warnings.length > 0 && !busy;
  const first = warnings[0];

  return (
    <>
      <div
        className={cn(
          'absolute bottom-3.25 left-3.5 flex items-center gap-2',
          busy && 'opacity-40',
        )}
      >
        <ToggleChip
          on={view.grid}
          label="grid"
          onToggle={() => setView((v) => ({ ...v, grid: !v.grid }))}
        />
        <ToggleChip
          on={view.reducedMotion}
          label="reduced motion"
          title="Preview with motion disabled"
          onToggle={() =>
            setView((v) => ({ ...v, reducedMotion: !v.reducedMotion, playing: false }))
          }
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

      <div
        className={cn(
          'absolute bottom-3.5 right-4 flex items-center gap-2.5',
          busy && 'opacity-40',
        )}
      >
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
            {status || (selected ? `${selected.name} selected` : 'nothing selected')}
          </span>
        )}
      </div>
    </>
  );
}
