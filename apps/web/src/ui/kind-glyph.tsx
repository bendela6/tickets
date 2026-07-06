export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';

export function KindGlyph({ kind }: { kind: StatusKind }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0">
      {kind === 'todo' ? <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" /> : null}
      {kind === 'active' ? (
        <>
          <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 1a4 4 0 0 0 0 8Z" fill="currentColor" />
        </>
      ) : null}
      {kind === 'blocked' ? <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill="currentColor" /> : null}
      {kind === 'done' ? (
        <>
          <circle cx="5" cy="5" r="4.5" fill="currentColor" />
          <path d="M3 5.2l1.5 1.6L7.2 3.8" fill="none" stroke="var(--ins-raised)" strokeWidth="1.4" />
        </>
      ) : null}
      {kind === 'dropped' ? (
        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5" />
      ) : null}
    </svg>
  );
}
