import { useMemo, useState } from 'react';
import { cn } from './cn';
import { ComboboxList, type ComboOption } from './combobox-list';
import { KindGlyph, type StatusKind } from './kind-glyph';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { StatusBadge } from './status-badge';

export type StatusOption = { key: string; label: string; kind: StatusKind };

type StatusSelectProps = {
  statuses: StatusOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Keys reachable from the current status per the workflow graph. Undefined = all allowed. */
  legalTargets?: string[];
  size?: 'compact' | 'regular';
  disabled?: boolean;
  className?: string;
};

const KIND_ORDER: { key: StatusKind; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'active', label: 'Active' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
  { key: 'dropped', label: 'Dropped' },
];

export function StatusSelect({
  statuses,
  value,
  onChange,
  legalTargets,
  size = 'regular',
  disabled,
  className,
}: StatusSelectProps) {
  const [open, setOpen] = useState(false);
  const kindByKey = useMemo(
    () => new Map(statuses.map((status) => [status.key, status.kind])),
    [statuses],
  );
  const current = statuses.find((status) => status.key === value) ?? null;

  const shown = useMemo(() => {
    if (!legalTargets) {
      return statuses;
    }
    const allowed = new Set([...legalTargets, ...(value ? [value] : [])]);
    return statuses.filter((status) => allowed.has(status.key));
  }, [statuses, legalTargets, value]);

  const hiddenCount = statuses.length - shown.length;
  const options: ComboOption[] = shown.map((status) => ({
    value: status.key,
    label: status.label,
  }));
  const groups = KIND_ORDER.filter((group) => shown.some((status) => status.kind === group.key));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-ctrl border border-control bg-raised pr-2 pl-1.5',
            'hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-subtle',
            'disabled:pointer-events-none disabled:opacity-50',
            size === 'compact' ? 'h-7' : 'h-9',
            className,
          )}
        >
          {current ? (
            <StatusBadge kind={current.kind} label={current.label} />
          ) : (
            <span className="pl-1 font-sans text-ui text-ink-3">Set status…</span>
          )}
          <span aria-hidden className="text-[10px] text-ink-3">
            ▾
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <ComboboxList
          options={options}
          isSelected={(candidate) => candidate === value}
          onPick={(picked) => {
            onChange(picked);
            setOpen(false);
          }}
          groupOf={(option) => kindByKey.get(option.value) ?? 'todo'}
          groups={groups}
          renderOption={(option) => {
            const kind = kindByKey.get(option.value) ?? 'todo';
            return (
              <span className="inline-flex items-center gap-2.25">
                <span className={cn('inline-flex', kindTextClass(kind))}>
                  <KindGlyph kind={kind} />
                </span>
                <span className="font-sans text-ui text-ink">{option.label}</span>
              </span>
            );
          }}
          footer={
            hiddenCount > 0
              ? `${hiddenCount} ${hiddenCount === 1 ? 'status' : 'statuses'} hidden by workflow`
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}

function kindTextClass(kind: StatusKind) {
  return {
    todo: 'text-kind-todo',
    active: 'text-kind-active',
    blocked: 'text-kind-blocked',
    done: 'text-kind-done',
    dropped: 'text-kind-dropped',
  }[kind];
}
