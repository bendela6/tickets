import type { CheckResult } from '../../engine/model/types';
import { cn } from '../../ui/cn';

interface ChecksOverlayProps {
  results: CheckResult[];
  onClose: () => void;
}

export function ChecksOverlay({ results, onClose }: ChecksOverlayProps) {
  return (
    <div className="absolute bottom-3.5 right-3.5 z-40 w-80 rounded-lg border border-border-2 bg-surface-2 px-3 py-3 text-sm shadow-overlay">
      <h3 className="mb-2 flex items-center justify-between text-base">
        Self-check
        <button type="button" className="text-lg text-muted hover:text-ink" onClick={onClose} aria-label="Close">
          ×
        </button>
      </h3>
      {results.map((r, i) => (
        <div key={i} className="flex items-baseline gap-2 py-1">
          <span className={cn('shrink-0 font-bold', { 'text-ok': r.pass, 'text-danger': !r.pass })}>{r.pass ? '✓' : '✗'}</span>
          <span className="text-muted">
            <b className="font-medium text-ink">{r.name}</b>
            {' — '}
            {r.pass ? `${r.scope} ok` : `${r.problems.length} problem(s): ${r.problems.slice(0, 4).join('; ')}`}
          </span>
        </div>
      ))}
    </div>
  );
}
