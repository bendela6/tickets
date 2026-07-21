import type { ReactNode } from 'react';
import { cn } from '../../ui/cn';

export type SignalStatus = 'open' | 'resolved' | 'ignored';

// Shape-coded per docs/design/SigGallery.dc.html "ISSUE STATUS — INHERITS THE
// STATUS-KIND SHAPES": open is a half-filled accent (kind-active) circle,
// resolved a filled ok (kind-done) circle with a check, ignored a dashed
// muted (kind-dropped) circle.
const STATUS: Record<SignalStatus, { chipClass: string; glyph: ReactNode; label: string }> = {
  open: {
    chipClass: 'bg-kind-active-subtle text-kind-active',
    glyph: (
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full border-[1.5px] border-kind-active box-border bg-[linear-gradient(90deg,var(--color-kind-active)_50%,transparent_50%)]"
      />
    ),
    label: 'open',
  },
  resolved: {
    chipClass: 'bg-kind-done-subtle text-kind-done',
    glyph: (
      <span
        aria-hidden
        className="flex size-2.25 shrink-0 items-center justify-center rounded-full bg-kind-done text-[6px] font-semibold leading-none text-on-kind-done"
      >
        ✓
      </span>
    ),
    label: 'resolved',
  },
  ignored: {
    chipClass: 'bg-kind-dropped-subtle text-kind-dropped',
    glyph: (
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full border-[1.5px] border-dashed border-kind-dropped box-border"
      />
    ),
    label: 'ignored',
  },
};

export function StatusChip({
  status,
  regressed,
  className,
}: {
  status: SignalStatus;
  regressed?: boolean;
  className?: string;
}) {
  const cfg = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'inline-flex h-5.5 items-center gap-1.5 rounded-md px-2.25 font-sans text-meta font-medium',
          cfg.chipClass,
        )}
      >
        {cfg.glyph}
        {cfg.label}
      </span>
      {regressed ? (
        // Design's regressed chip uses a 5px internal gap (narrower than the
        // 6px status-chip gap) — gap-1.25 (1.25 * 4px) matches the repo's
        // existing convention for odd pixel values (px-2.25, h-5.5, etc.).
        <span className="inline-flex h-5.5 items-center gap-1.25 rounded-md bg-kind-blocked-subtle px-2.25 font-sans text-[11px] font-semibold text-kind-blocked">
          ↺ regressed
        </span>
      ) : null}
    </span>
  );
}
