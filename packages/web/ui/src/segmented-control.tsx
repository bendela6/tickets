import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './icons/icon';

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label?: ReactNode; icon?: IconName }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-[7px] bg-inset p-0.75', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            aria-label={opt.label == null ? opt.value : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-ctrl px-2.75 py-1 text-meta font-medium',
              active ? 'bg-raised text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
            )}
          >
            {opt.icon ? <Icon name={opt.icon} size={12} /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
