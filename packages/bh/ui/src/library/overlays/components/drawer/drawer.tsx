import { createContext, useContext, type ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { cn } from '../../../../style/cn';
import { Button } from '../../../primitives/components/button';
import {
  usePanelWidth,
  usePersistedFlag,
  useViewportUnder,
  type PanelSide,
} from '../../parts/panel';
import { useRestoreFocus } from '../../parts/restore-focus';

export const DRAWER_SIZES = { sm: 288, md: 400, lg: 620 } as const;

export type DrawerSize = keyof typeof DRAWER_SIZES;

/** The edge a drawer slides in from: a side, or the bottom, as a phone's sheet. */
export type DrawerSide = PanelSide | 'bottom';

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
  /**
   * The edge it slides in from. From the `bottom` it is a sheet as wide as the
   * window and as tall as its content, rounded at the top, that can't be
   * resized: `size`, the widths and `maximizable` don't apply.
   */
  side?: DrawerSide;
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

/** A modal panel that slides in from the left or right edge of the page, or up from its bottom. */
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
  const bottom = side === 'bottom';
  const { width, panelRef, getSeparatorProps } = usePanelWidth({
    // A sheet has no width to drag; the hook still runs, as hooks must.
    side: bottom ? 'right' : side,
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

  // Radix gives focus back only to a `Dialog.Trigger`, and a drawer has none:
  // a row or a button of the app's opens it. The hook remembers the element
  // focus left as it first entered the drawer, so a drawer mounted already
  // open counts, and content swapped while it is open (a master-detail link
  // inside it) does not move the target.
  const restoreFocus = useRestoreFocus();

  return (
    <DrawerContext.Provider value={{ maximized, setMaximized, maximizable }}>
      <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
          <RadixDialog.Content
            ref={panelRef}
            // Radix warns without a description; this drawer's body is
            // arbitrary content, so there is nothing honest to point at.
            aria-describedby={undefined}
            onFocus={restoreFocus.onFocus}
            onCloseAutoFocus={restoreFocus.onCloseAutoFocus}
            style={
              bottom ? { maxHeight: `calc(100dvh - ${TAP_STRIP})` } : { '--panel-w': panelWidth }
            }
            className={cn(
              'fixed z-50 flex flex-col outline-none',
              'border-gray-6 bg-surface-raised text-gray-12 font-sans shadow-lg',
              bottom
                ? 'panel-slide-bottom rounded-t-16 inset-x-0 bottom-0 border-t-1'
                : 'inset-y-0 w-(--panel-w)',
              side === 'right' && 'panel-slide-right right-0 border-l-1',
              side === 'left' && 'panel-slide-left left-0 border-r-1',
              className,
            )}
          >
            <RadixDialog.Title className="sr-only">{label}</RadixDialog.Title>
            {/* Nothing to drag once the drawer already fills the viewport. */}
            {bottom || maximized || tooNarrowToDrag ? null : (
              <div
                {...getSeparatorProps()}
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
        <Button
          variant="ghost"
          tone="neutral"
          size="sm"
          icon={maximized ? 'minimize' : 'maximize'}
          label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => setMaximized(!maximized)}
        />
      ) : null}
      <RadixDialog.Close asChild>
        <Button variant="ghost" tone="neutral" size="sm" icon="x" label="Close" />
      </RadixDialog.Close>
    </div>
  );
}
