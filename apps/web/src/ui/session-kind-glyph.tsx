import { cn } from './cn';

export type SessionKind = 'terminal' | 'agent';

// A compact, unmistakable terminal-vs-agent mark (screen 10) used in the
// sessions list, tabs, and headers. Terminal is an inked `>_` prompt; an agent
// is the accent asterisk that stands in for a persona throughout the product.
export function SessionKindGlyph({
  kind,
  className,
}: {
  kind: SessionKind;
  className?: string;
}) {
  const terminal = kind === 'terminal';
  return (
    <span
      role="img"
      aria-label={terminal ? 'terminal session' : 'agent session'}
      className={cn(
        'inline-flex size-5 shrink-0 select-none items-center justify-center rounded-ctrl font-mono leading-none',
        terminal
          ? 'bg-ink text-app text-[8px] font-semibold'
          : 'bg-accent-subtle text-accent text-[10px] font-medium',
        className,
      )}
    >
      {terminal ? '>_' : '✳'}
    </span>
  );
}
