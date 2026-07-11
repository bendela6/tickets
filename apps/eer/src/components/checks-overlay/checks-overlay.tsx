import type { CheckResult } from '../../engine/model/types';
import { cn } from '../../ui/cn';

interface ChecksOverlayProps {
  results: CheckResult[];
  onClose: () => void;
}

export function ChecksOverlay({ results, onClose }: ChecksOverlayProps) {
  return (
    <div className="absolute bottom-3.5 right-3.5 z-40 w-[320px] rounded-lg border border-border-2 bg-surface-2 px-[0.8rem] py-[0.7rem] text-[0.76rem] shadow-[0_12px_34px_rgba(0,0,0,0.5)]">
      <h3 className="mb-2 flex items-center justify-between text-[0.8rem]">
        Self-check
        <button type="button" className="text-base text-muted hover:text-ink" onClick={onClose} aria-label="Close">
          ×
        </button>
      </h3>
      {results.map((r, i) => (
        <div key={i} className="flex items-baseline gap-2 py-[0.28rem]">
          <span className={cn('shrink-0 font-bold', r.pass ? 'text-ok' : 'text-danger')}>{r.pass ? '✓' : '✗'}</span>
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
