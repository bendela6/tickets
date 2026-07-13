import type { CheckResult } from '../../engine/model/types';
import { cn } from '../../ui/cn';

interface ChecksOverlayProps {
  results: CheckResult[];
  onClose: () => void;
}

export function ChecksOverlay({ results, onClose }: ChecksOverlayProps) {
  return (
    <div
      className={cn(
        'absolute bottom-4 right-4 z-40 w-80 px-3 py-3',
        'rounded-lg border border-gray-500 bg-gray-800 text-sm shadow-xl',
      )}
    >
      <h3 className="mb-2 flex items-center justify-between text-base">
        Self-check
        <button type="button" className="text-lg text-gray-200 hover:text-gray-50" onClick={onClose} aria-label="Close">
          ×
        </button>
      </h3>
      {results.map((r, i) => (
        <div key={i} className="flex items-baseline gap-2 py-1">
          <span className={cn('shrink-0 font-bold', { 'text-green-400': r.pass, 'text-red-400': !r.pass })}>{r.pass ? '✓' : '✗'}</span>
          <span className="text-gray-200">
            <b className="font-medium text-gray-50">{r.name}</b>
            {' — '}
            {r.pass ? `${r.scope} ok` : `${r.problems.length} problem(s): ${r.problems.slice(0, 4).join('; ')}`}
          </span>
        </div>
      ))}
    </div>
  );
}
