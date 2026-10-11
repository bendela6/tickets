import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { cn } from '../../../../style/cn';
import { Icon } from '../../../primitives/components/icon';
import {
  usePanelWidth,
  usePersistedFlag,
  useViewportUnder,
  type PanelSide,
} from '../../parts/panel';

export const DRAWER_SIZES = { sm: 288, md: 400, lg: 620 } as const;

export type DrawerSize = keyof typeof DRAWER_SIZES;

// Every drawer leaves this much of the page uncovered, so there is always a
// scrim left to tap on a narrow screen.
const TAP_STRIP = '3rem';
const TAP_STRIP_PX = 48;

interface DrawerContextValue {
  maximized: boolean;
  setMaximized: (next: boolean) => void;
  maximizable: boolean;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export interface DrawerProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Called with the new open state: `false` on Esc, a click on the dim or the close button. */
  onOpenChange: (open: boolean) => void;
  /** Names the drawer for assistive technology, and its resize handle. It is not shown. */
  label: string;
  /** The edge it slides in from. */
  side?: PanelSide;
  /** Its starting width: `sm` 288, `md` 400 or `lg` 620 pixels. */
  size?: DrawerSize;
  /** The narrowest the reader can drag it, in pixels. */
  minWidth?: number;
  /** The widest the reader can drag it, in pixels. */
  maxWidth?: number;
  /**
   * Remembers its width and whether it is maximized in `localStorage`, under
   * this key with `:width` and `:maximized` after it. Without one, it
   * remembers nothing.
   */
  storageKey?: string;
  /** Adds a Maximize button to `DrawerControls`, which widens the drawer to the window. */
  maximizable?: boolean;
  /** Classes merged onto the panel. */
  className?: string;
  /** The drawer's content, laid out as a column. */
  children: ReactNode;
}

/** A modal panel that slides in from the left or right edge of the page. */
export function Drawer({
  open,
  onOpenChange,
  label,
  side = 'right',
  size = 'md',
  minWidth = 280,
  maxWidth = 960,
  storageKey,
  maximizable = false,
  className,
  children,
}: DrawerProps) {
  const { width, panelRef, separatorProps } = usePanelWidth({
    side,
    defaultWidth: DRAWER_SIZES[size],
    minWidth,
    maxWidth,
    storageKey: storageKey && `${storageKey}:width`,
    label,
  });
  const [maximized, setMaximized] = usePersistedFlag(
    storageKey && `${storageKey}:maximized`,
    false,
  );
  // On a viewport this narrow the drawer is already at its cap, so there is no
  // width left to drag it into.
  const tooNarrowToDrag = useViewportUnder(minWidth + TAP_STRIP_PX);

  // Both bounds live in CSS rather than JS: the cap has to follow a window
  // resize, and nothing here re-measures on one.
  const panelWidth = maximized
    ? `calc(100vw - ${TAP_STRIP})`
    : `min(${width}px, 100vw - ${TAP_STRIP})`;

  // Radix only knows how to hand focus back to a `Dialog.Trigger`; this drawer
  // is opened by an arbitrary consumer-owned control, so it tracks and
  // restores focus itself rather than leaving it to fall back to <body>.
  // `wasOpenRef` starts `false` regardless of the incoming `open` value so a
  // consumer that mounts the whole component already open (Task 4: `<Drawer
  // open>` mounted/unmounted around row selection, never a false→true
  // transition) still gets a capture on its very first render, not only on a
  // later transition. Captured during render, not an effect: the Content's
  // own FocusScope mount effect (a descendant) runs before this component's
  // effects would, and it moves focus into the panel first — by the time a
  // `useEffect` here ran, `document.activeElement` would already be inside
  // the drawer instead of the real opener.
  //
  // Deliberately NOT re-captured while already open: master-detail call
  // sites swap `children`/`label` underneath one open `Drawer` instance via
  // links inside the panel (e.g. `ItemDetail`'s `onOpenItem`). The modal
  // scrim means the user cannot have focused anything behind the drawer in
  // the meantime, so the correct restore target stays the element that was
  // focused when the drawer first opened — where the user actually entered
  // from — not wherever in-drawer navigation last happened to focus.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  if (open && !wasOpenRef.current) {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
  }
  wasOpenRef.current = open;

  return (
    <DrawerContext.Provider value={{ maximized, setMaximized, maximizable }}>
      <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
          <RadixDialog.Content
            ref={panelRef as React.RefObject<HTMLDivElement>}
            // Radix warns without a description; this drawer's body is
            // arbitrary content, so there is nothing honest to point at.
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              restoreFocusRef.current?.focus();
            }}
            style={{ '--panel-w': panelWidth }}
            className={cn(
              'fixed inset-y-0 z-50 flex w-(--panel-w) flex-col outline-none',
              'border-gray-6 bg-surface-raised text-gray-12 font-sans shadow-lg',
              side === 'right'
                ? 'panel-slide-right right-0 border-l-1'
                : 'panel-slide-left left-0 border-r-1',
              className,
            )}
          >
            <RadixDialog.Title className="sr-only">{label}</RadixDialog.Title>
            {/* Nothing to drag once the drawer already fills the viewport. */}
            {maximized || tooNarrowToDrag ? null : (
              <div
                {...separatorProps}
                className={cn(
                  'hover:bg-indigo-9 absolute inset-y-0 z-10 w-6 cursor-col-resize',
                  side === 'right' ? 'left-0' : 'right-0',
                )}
              />
            )}
            {children}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </DrawerContext.Provider>
  );
}

const CONTROL =
  'inline-flex size-28 shrink-0 items-center justify-center rounded-6 text-gray-11 hover:bg-surface-inset hover:text-gray-12';

/** The drawer's Close button, and its Maximize button when it is `maximizable`. Only inside a Drawer. */
export function DrawerControls({
  className,
}: {
  /** Classes merged onto the buttons' row. */
  className?: string;
}) {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('DrawerControls must be rendered within a Drawer');
  }
  const { maximized, setMaximized, maximizable } = context;
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      {maximizable ? (
        <button
          type="button"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => setMaximized(!maximized)}
          className={CONTROL}
        >
          <Icon name={maximized ? 'minimize' : 'maximize'} size="md" />
        </button>
      ) : null}
      <RadixDialog.Close aria-label="Close" title="Close" className={CONTROL}>
        <Icon name="x" size="md" />
      </RadixDialog.Close>
    </div>
  );
}
