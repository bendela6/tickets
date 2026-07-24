import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './icons/icon';

type Variant = 'underline' | 'pill' | 'rail';

const LIST: Record<Variant, string> = {
  underline: 'flex items-center gap-4.5 border-b-(length:--border-hair) border-hairline',
  pill: 'inline-flex items-center gap-1 rounded-[7px] bg-inset p-0.75',
  rail: 'flex flex-col gap-0.5',
};
const TAB: Record<Variant, { base: string; active: string; inactive: string }> = {
  underline: {
    base: '-mb-px border-b-2 px-0.5 pb-2 pt-1.75 text-ui',
    active: 'border-accent font-medium text-ink',
    inactive: 'border-transparent text-ink-2 hover:text-ink',
  },
  pill: {
    base: 'rounded-ctrl px-3 py-1 text-meta font-medium',
    active: 'bg-raised text-ink shadow-sm',
    inactive: 'text-ink-2 hover:text-ink',
  },
  rail: {
    base: 'rounded-tile px-2.5 py-1.5 text-left text-ui',
    active: 'bg-accent-subtle font-medium text-accent',
    inactive: 'text-ink-2 hover:bg-inset hover:text-ink',
  },
};

export function Tabs({
  variant = 'underline',
  items,
  value,
  onChange,
  label,
  className,
}: {
  variant?: Variant;
  items: { value: string; label: ReactNode; icon?: IconName; badge?: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn(LIST[variant], className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5',
              TAB[variant].base,
              active ? TAB[variant].active : TAB[variant].inactive,
            )}
          >
            {item.icon ? <Icon name={item.icon} size={12} /> : null}
            {item.label}
            {item.badge != null ? <span className="font-mono text-[10px] text-ink-3">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
