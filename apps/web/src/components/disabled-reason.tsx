import type { ReactElement } from 'react';
import { Tooltip } from '@tilewise/ui';

// A control and, while there is a reason it can't be used, a tooltip saying
// it. A disabled button hears no pointer (tilewise's Button lets it through), so the
// tooltip sits on a span around the control rather than on the control.
export function DisabledReason({
  reason,
  children,
}: {
  /** Why the control is disabled; nothing shows without one. */
  reason: string | undefined;
  /** The control. */
  children: ReactElement;
}) {
  if (reason === undefined) {
    return children;
  }
  return (
    <Tooltip content={reason}>
      <span className="inline-flex">{children}</span>
    </Tooltip>
  );
}
