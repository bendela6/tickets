import type { ReactNode } from 'react';
import { cn } from '../../style/cn';
import { Icon, type IconName } from '../icon';

export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: string; label?: ReactNode; icon?: IconName }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-[7px] bg-surface-inset p-0.75', className)}
    >
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
              'inline-flex items-center gap-1.5 rounded-md px-2.75 py-1 text-meta font-medium',
              active ? 'bg-surface-raised text-gray-12 shadow-sm' : 'text-gray-11 hover:text-gray-12',
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
