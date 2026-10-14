import { createContext, useContext, type ReactNode } from 'react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { cn } from '../../../../style/cn';

const DELAY = 300;

// Whether a TooltipProvider is above. Radix's Tooltip throws without its
// Provider, and every Button with a `label` draws a Tooltip, so one outside a
// provider (a test, a page that never set one up) brings its own instead.
const Provided = createContext(false);

/** Sets the delay for every Tooltip under it: 300 milliseconds of hover before one shows. */
export function TooltipProvider({
  children,
}: {
  /** The app, or the part of it that has tooltips. */
  children: ReactNode;
}) {
  return (
    <Provided.Provider value>
      <RadixTooltip.Provider delayDuration={DELAY}>{children}</RadixTooltip.Provider>
    </Provided.Provider>
  );
}

interface TooltipProps {
  /** What the tooltip says. */
  content: ReactNode;
  /** The trigger: one element that takes a ref and focus, like a Button. */
  children: ReactNode;
  /** The side of the trigger it shows on. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Classes merged onto the tooltip. */
  className?: string;
}

/** A short hint that shows when its trigger is hovered or focused. */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const provided = useContext(Provided);
  const root = (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={5}
          className={cn(
            'rounded-6 bg-gray-12 text-12/17 text-gray-1 z-50 max-w-256 px-8 py-4 font-sans',
            'select-none',
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-gray-12" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
  return provided ? (
    root
  ) : (
    <RadixTooltip.Provider delayDuration={DELAY}>{root}</RadixTooltip.Provider>
  );
}
