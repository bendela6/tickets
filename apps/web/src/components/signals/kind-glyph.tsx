import { cn } from '@tickets/ui/cn';

export type SignalKind = 'event' | 'log' | 'click' | 'navigation' | 'http' | 'error' | 'custom';

// Glyph set per docs/design/SigGallery.dc.html "SIGNAL-KIND GLYPHS —
// BREADCRUMBS & SESSION TIMELINE". `event` gets the accent treatment, `error`
// danger; the rest (log/click/navigation/http, plus `custom` which the
// gallery doesn't enumerate) share the neutral inset badge.
const KIND: Record<SignalKind, { glyph: string; className: string }> = {
  event: { glyph: '◆', className: 'bg-accent-subtle text-accent text-[10px]' },
  log: { glyph: '≡', className: 'bg-inset text-ink-2 text-[11px]' },
  click: { glyph: '◉', className: 'bg-inset text-ink-2 text-[10px]' },
  navigation: { glyph: '→', className: 'bg-inset text-ink-2 text-[11px]' },
  http: { glyph: '⇅', className: 'bg-inset text-ink-2 text-[10px]' },
  error: { glyph: '✕', className: 'bg-danger-subtle text-danger text-[10px] font-semibold' },
  custom: { glyph: '✳', className: 'bg-inset text-ink-2 text-[10px]' },
};

export function KindGlyph({ type, className }: { type: SignalKind; className?: string }) {
  const cfg = KIND[type];
  return (
    <span
      role="img"
      aria-label={type}
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] font-mono font-medium leading-none',
        cfg.className,
        className,
      )}
    >
      {cfg.glyph}
    </span>
  );
}
