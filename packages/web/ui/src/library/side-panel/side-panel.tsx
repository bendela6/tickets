import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../style/cn';
import { Drawer } from '../drawer';
import { Icon } from '../primitives/components/icon';
import {
  useIsNarrow,
  usePanelWidth,
  usePersistedFlag,
  type PanelBreakpoint,
  type PanelSide,
} from '../panel';

export type CollapsedTo = 'rail' | 'edge';

export type SidePanelProps = {
  label: string;
  side?: PanelSide;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  collapsible?: boolean;
  collapsedTo?: CollapsedTo;
  overlayBelow?: PanelBreakpoint;
  className?: string;
  children: ReactNode;
};

const TOGGLE =
  'flex size-28 shrink-0 items-center justify-center rounded-md text-gray-11 hover:bg-surface-inset hover:text-gray-12';

// Shared by the two states that have no panel on screen to hang a toggle off:
// collapsedTo="edge" and the narrow overlay. Fixed, so a shut panel costs the
// content no horizontal space.
function ReopenButton({
  label,
  side,
  expanded,
  onClick,
}: {
  label: string;
  side: PanelSide;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Show ${label}`}
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'fixed top-12 z-40 flex size-36 items-center justify-center rounded-md',
        'border-1 border-gray-6 bg-surface-raised text-gray-11 shadow-sm hover:text-gray-12',
        side === 'left' ? 'left-12' : 'right-12',
      )}
    >
      <Icon name="rows" size="md" />
    </button>
  );
}

export function SidePanel({
  label,
  side = 'left',
  defaultWidth = 224,
  minWidth = 180,
  maxWidth = 400,
  storageKey,
  collapsible = false,
  collapsedTo = 'rail',
  overlayBelow,
  className,
  children,
}: SidePanelProps) {
  const { width, panelRef, separatorProps } = usePanelWidth({
    side,
    defaultWidth,
    minWidth,
    maxWidth,
    storageKey: storageKey && `${storageKey}:width`,
    label,
  });
  const [collapsed, setCollapsed] = usePersistedFlag(
    storageKey && `${storageKey}:collapsed`,
    false,
  );
  const narrow = useIsNarrow(overlayBelow);
  // Overlay open/shut is deliberately NOT the persisted `collapsed` preference.
  // A temporary peek at the overlay is not a preference worth remembering, and
  // writing it through would leave the panel collapsed once the window widens
  // again — losing the choice the user actually made while docked.
  const [overlayOpen, setOverlayOpen] = useState(false);
  // Each time the viewport (re-)enters narrow, the overlay must start shut.
  // Without this, widening past the breakpoint unmounts the Drawer but
  // leaves `overlayOpen` at whatever it last was; narrowing again would then
  // pop the Drawer back open with no user gesture. This is the ephemeral
  // half of the state, so resetting it here does not touch the persisted
  // `collapsed` flag or storage at all.
  useEffect(() => {
    if (narrow) setOverlayOpen(false);
  }, [narrow]);

  if (narrow) {
    // Below the breakpoint the panel is an overlay: same children, same label,
    // with radix's focus trap and scroll lock on top.
    return (
      <>
        <ReopenButton
          label={label}
          side={side}
          expanded={overlayOpen}
          onClick={() => setOverlayOpen(true)}
        />
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
    if (collapsedTo === 'edge') {
      return <ReopenButton label={label} side={side} expanded={false} onClick={open} />;
    }
    return (
      <button
        type="button"
        aria-label={`Show ${label}`}
        aria-expanded={false}
        onClick={open}
        className={cn(
          'flex h-full w-24 shrink-0 items-center justify-center bg-gray-2 text-gray-11',
          'hover:bg-surface-inset hover:text-gray-12',
          side === 'left' ? 'border-r-1 border-gray-6' : 'border-l-1 border-gray-6',
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
        'relative flex w-(--panel-w) shrink-0 flex-col bg-gray-2',
        side === 'left' ? 'border-r-1 border-gray-6' : 'border-l-1 border-gray-6',
        className,
      )}
    >
      <div
        {...separatorProps}
        className={cn(
          'absolute inset-y-0 z-10 w-6 cursor-col-resize hover:bg-indigo-9',
          side === 'left' ? 'right-0' : 'left-0',
        )}
      />
      {collapsible ? (
        <div
          className={cn(
            'flex shrink-0 border-b-1 border-gray-6 px-8 py-4',
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
