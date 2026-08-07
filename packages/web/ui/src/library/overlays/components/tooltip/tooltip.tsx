import type { ReactNode } from 'react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { cn } from '../../../../style/cn';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={300}>{children}</RadixTooltip.Provider>;
}

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
};

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={5}
          className={cn(
            'z-50 max-w-256 rounded-6 bg-gray-12 px-8 py-4 font-sans text-12/17 text-gray-1',
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
}
