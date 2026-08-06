import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../style/cn';
import { Icon } from '../icon';

// Copies text to the clipboard, tracking a transient copied/failed state that
// self-resets after `resetMs`. Retires N near-identical CopyState machines
// (dsn-field, sdk-snippet, session-screen, item-detail) that each hand-rolled
// this same idle/copied/failed dance with their own setTimeout.
export function useCopy(resetMs = 1500) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Cleanup only, deliberately not depending on `state` — clears whatever
  // timer is pending at unmount so no reset fires after the component is gone.
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), resetMs);
  };
  return { copied: state === 'copied', failed: state === 'failed', copy };
}

export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  failedLabel = 'Failed',
  resetMs = 1500,
  className,
}: {
  value: string;
  label?: ReactNode;
  copiedLabel?: ReactNode;
  failedLabel?: ReactNode;
  resetMs?: number;
  className?: string;
}) {
  const { copied, failed, copy } = useCopy(resetMs);
  return (
    <button
      type="button"
      onClick={() => void copy(value)}
      className={cn(
        'inline-flex items-center gap-6 rounded-md border-2 px-10 py-4 font-mono text-11',
        // The outline pair — 7 borders, 11 texts — on the scales `success` and
        // `danger` resolve to. Spelled rather than resolved: only two states
        // exist here and neither is parameterised, so a lookup would hide two
        // literals behind a function call.
        copied
          ? 'border-green-7 text-green-11'
          : failed
            ? 'border-red-7 text-red-11'
            : 'border-gray-6 text-gray-11 hover:bg-surface-inset',
        className,
      )}
    >
      <Icon name={copied ? 'check' : 'copy'} size="xs" />
      {copied ? copiedLabel : failed ? failedLabel : label}
    </button>
  );
}
