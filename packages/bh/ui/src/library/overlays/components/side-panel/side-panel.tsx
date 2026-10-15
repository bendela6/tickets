import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { cn } from '../../../../style/cn';
import { Drawer } from '../drawer';
import { Icon } from '../../../primitives/components/icon';
import {
  useIsNarrow,
  usePanelWidth,
  usePersistedFlag,
  type PanelBreakpoint,
  type PanelSide,
} from '../../parts/panel';
import { useRestoreFocus } from '../../parts/restore-focus';

/**
 * What a shut panel leaves behind: a thin rail to reopen it from, a floating
 * button at the viewport's edge, or nothing at all — for a panel whose page
 * already has its own control to reopen it (a table's "Filters" button).
 */
export type CollapsedTo = 'rail' | 'edge' | 'none';

export interface SidePanelProps {
  /** Names the panel for assistive technology, and its buttons and resize handle. */
  label: string;
  /** The side of the layout it docks to. */
  side?: PanelSide;
  /** Its width in pixels until the reader resizes it. */
  defaultWidth?: number;
  /** The narrowest the reader can drag it, in pixels. */
  minWidth?: number;
  /** The widest the reader can drag it, in pixels. */
  maxWidth?: number;
  /**
   * Remembers its width and whether it is collapsed in `localStorage`, under
   * this key with `:width` and `:collapsed` after it. Without one, it
   * remembers nothing.
   */
  storageKey?: string;
  /** Adds a button at its top that hides the panel. */
  collapsible?: boolean;
  /** What a hidden panel leaves: a `rail` to reopen it from, a button at the window's `edge`, or `none`. */
  collapsedTo?: CollapsedTo;
  /**
   * Whether a shut panel draws the floating button that brings it back:
   * below `overlayBelow`, and at `collapsedTo="edge"`. `false` leaves none,
   * for a page that opens the panel from a control of its own, given `open`.
   * A docked panel's rail stays.
   */
  reopenButton?: boolean;
  /**
   * Below this breakpoint, the panel floats over the content as a Drawer
   * instead. Without it, the panel stays docked at every width.
   */
  overlayBelow?: PanelBreakpoint;
  /**
   * Open or shut, owned by the caller. With it the panel keeps no open state
   * of its own — neither the persisted docked flag nor the overlay's — so a
   * control elsewhere on the page can open it, and closing it from inside
   * (the hide toggle, the overlay's dismiss) goes through `onOpenChange`.
   */
  open?: boolean;
  /** Called with the new open state when `open` is given: from its buttons, or its drawer closing. */
  onOpenChange?: (open: boolean) => void;
  /** Classes merged onto the docked panel. */
  className?: string;
  /** The panel's content, in a column that scrolls. */
  children: ReactNode;
}

const TOGGLE =
  'flex size-28 shrink-0 items-center justify-center rounded-6 text-gray-11 hover:bg-surface-inset hover:text-gray-12';

// Shared by the two states that have no panel on screen to hang a toggle off:
// collapsedTo="edge" and the narrow overlay. Floating, so a shut panel costs
// the content no horizontal space: over the window at the edge, and over the
// panel's own place in the layout below the breakpoint.
function ReopenButton({
  ref,
  label,
  side,
  expanded,
  over,
  onClick,
}: {
  ref: Ref<HTMLButtonElement>;
  label: string;
  side: PanelSide;
  expanded: boolean;
  /** Pinned to the `window`, or to the zero-wide `layout` box the panel would dock in. */
  over: 'window' | 'layout';
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Show ${label}`}
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'rounded-6 top-12 flex size-36 items-center justify-center',
        over === 'window' ? 'fixed z-40' : 'absolute z-10',
        'border-gray-6 bg-surface-raised text-gray-11 hover:text-gray-12 border-1 shadow-sm',
        side === 'left' ? 'left-12' : 'right-12',
      )}
    >
      <Icon name="rows" size="md" />
    </button>
  );
}

/** A column beside the content that the reader can resize and collapse. */
export function SidePanel({
  label,
  side = 'left',
  defaultWidth = 224,
  minWidth = 180,
  maxWidth = 400,
  storageKey,
  collapsible = false,
  collapsedTo = 'rail',
  reopenButton = true,
  overlayBelow,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
}: SidePanelProps) {
  const controlled = controlledOpen !== undefined;
  const { width, panelRef, getSeparatorProps } = usePanelWidth({
    side,
    defaultWidth,
    minWidth,
    maxWidth,
    storageKey: storageKey && `${storageKey}:width`,
    label,
  });
  const [persistedCollapsed, setPersistedCollapsed] = usePersistedFlag(
    storageKey && `${storageKey}:collapsed`,
    false,
  );
  const collapsed = controlled ? !controlledOpen : persistedCollapsed;
  const setCollapsed = (next: boolean) => {
    if (controlled) {
      onOpenChange?.(!next);
    } else {
      setPersistedCollapsed(next);
    }
  };
  const narrow = useIsNarrow(overlayBelow);
  // Overlay open/shut is deliberately NOT the persisted `collapsed` preference.
  // A temporary peek at the overlay is not a preference worth remembering, and
  // writing it through would leave the panel collapsed once the window widens
  // again — losing the choice the user actually made while docked.
  const [ownOverlayOpen, setOwnOverlayOpen] = useState(false);
  const overlayOpen = controlled ? controlledOpen : ownOverlayOpen;
  const setOverlayOpen = (next: boolean) => {
    if (controlled) {
      onOpenChange?.(next);
    } else {
      setOwnOverlayOpen(next);
    }
  };
  // Each time the viewport (re-)enters narrow, the overlay must start shut.
  // Without this, widening past the breakpoint unmounts the Drawer but
  // leaves `overlayOpen` at whatever it last was; narrowing again would then
  // pop the Drawer back open with no user gesture. This is the ephemeral
  // half of the state, so resetting it here does not touch the persisted
  // `collapsed` flag or storage at all.
  //
  // A controlled panel is exempt: its caller decides, and has not asked.
  useEffect(() => {
    if (narrow) {
      setOwnOverlayOpen(false);
    }
  }, [narrow]);

  // Hidden from its own button, the panel takes focus away with it. The hook
  // gives focus back to what opened the panel, such as a button elsewhere on
  // the page, or else to the button that brings the panel back. A panel the
  // page lays out open was opened by nothing, so mounting open does not
  // count. Below the breakpoint, the Drawer gives focus back by itself.
  const reopenRef = useRef<HTMLButtonElement>(null);
  useRestoreFocus({
    open: !collapsed,
    rememberOnMount: false,
    fallback: () => reopenRef.current,
  });

  if (narrow) {
    // Below the breakpoint the panel is an overlay: same children, same label,
    // with radix's focus trap and scroll lock on top.
    return (
      <>
        {collapsedTo === 'none' || !reopenButton ? null : (
          // In the panel's place in the layout, not over the window: on a
          // phone the window's top holds the frame's own bar (AppShell's
          // menu button sat right under this one), and the page's header.
          // Zero wide, so it still costs the content no column.
          <div className="relative w-0 shrink-0">
            <ReopenButton
              ref={reopenRef}
              label={label}
              side={side}
              expanded={overlayOpen}
              over="layout"
              onClick={() => setOverlayOpen(true)}
            />
          </div>
        )}
        <Drawer
          open={overlayOpen}
          onOpenChange={setOverlayOpen}
          side={side}
          size="sm"
          label={label}
        >
          {children}
        </Drawer>
      </>
    );
  }

  const open = () => setCollapsed(false);

  if (collapsed) {
    if (collapsedTo === 'none') {
      return null;
    }
    if (collapsedTo === 'edge') {
      return reopenButton ? (
        <ReopenButton
          ref={reopenRef}
          label={label}
          side={side}
          expanded={false}
          over="window"
          onClick={open}
        />
      ) : null;
    }
    return (
      <button
        ref={reopenRef}
        type="button"
        aria-label={`Show ${label}`}
        aria-expanded={false}
        onClick={open}
        className={cn(
          'bg-gray-2 text-gray-11 flex h-full w-24 shrink-0 items-center justify-center',
          'hover:bg-surface-inset hover:text-gray-12',
          side === 'left' ? 'border-gray-6 border-r-1' : 'border-gray-6 border-l-1',
        )}
      >
        <Icon name={side === 'left' ? 'chevron-right' : 'chevron-left'} size="md" />
      </button>
    );
  }

  return (
    <aside
      ref={panelRef}
      aria-label={label}
      style={{ '--panel-w': `${width}px` }}
      className={cn(
        'bg-gray-2 relative flex w-(--panel-w) shrink-0 flex-col',
        side === 'left' ? 'border-gray-6 border-r-1' : 'border-gray-6 border-l-1',
        className,
      )}
    >
      <div
        {...getSeparatorProps()}
        className={cn(
          'hover:bg-indigo-9 absolute inset-y-0 z-10 w-6 cursor-col-resize',
          side === 'left' ? 'right-0' : 'left-0',
        )}
      />
      {collapsible ? (
        <div
          className={cn(
            'border-gray-6 flex shrink-0 border-b-1 px-8 py-4',
            side === 'left' ? 'justify-start' : 'justify-end',
          )}
        >
          <button
            type="button"
            aria-label={`Hide ${label}`}
            aria-expanded
            onClick={() => setCollapsed(true)}
            className={TOGGLE}
          >
            <Icon name={side === 'left' ? 'chevron-left' : 'chevron-right'} size="md" />
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </aside>
  );
}
