import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { cn } from '../../style/cn';
import { runtimeStyle } from '../../style/runtime-style';
import { Icon } from '../icon';
import { usePanelWidth, usePersistedFlag, useViewportUnder, type PanelSide } from '../panel';

export const DRAWER_SIZES = { sm: 288, md: 400, lg: 620 } as const;

export type DrawerSize = keyof typeof DRAWER_SIZES;

// Every drawer leaves this much of the page uncovered, so there is always a
// scrim left to tap on a narrow screen.
const TAP_STRIP = '3rem';
const TAP_STRIP_PX = 48;

type DrawerContextValue = { maximized: boolean; setMaximized: (next: boolean) => void; maximizable: boolean };

const DrawerContext = createContext<DrawerContextValue | null>(null);

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  side?: PanelSide;
  size?: DrawerSize;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  maximizable?: boolean;
  className?: string;
  children: ReactNode;
};

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
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  if (open !== wasOpenRef.current) {
    if (open) restoreFocusRef.current = document.activeElement as HTMLElement | null;
    wasOpenRef.current = open;
  }

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
            style={runtimeStyle({ '--panel-w': panelWidth })}
            className={cn(
              'fixed inset-y-0 z-50 flex w-(--panel-w) flex-col outline-none',
              'border-gray-6 bg-surface-raised font-sans text-gray-12 shadow-lg',
              side === 'right' ? 'right-0 border-l-1 panel-slide-right' : 'left-0 border-r-1 panel-slide-left',
              className,
            )}
          >
            <RadixDialog.Title className="sr-only">{label}</RadixDialog.Title>
            {/* Nothing to drag once the drawer already fills the viewport. */}
            {maximized || tooNarrowToDrag ? null : (
              <div
                {...separatorProps}
                className={cn(
                  'absolute inset-y-0 z-10 w-1.5 cursor-col-resize hover:bg-indigo-9',
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
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-gray-11 hover:bg-surface-inset hover:text-gray-12';

export function DrawerControls({ className }: { className?: string }) {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('DrawerControls must be rendered within a Drawer');
  }
  const { maximized, setMaximized, maximizable } = context;
  return (
    <div className={cn('flex shrink-0 items-center gap-0.5', className)}>
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
