import { useMemo, useState } from 'react';
import { cn, ComboboxList, type ComboOption, fieldClass, fieldState, type FieldSize, Icon, Pill, Popover, PopoverContent, PopoverTrigger, TONE_HUE, type Tone } from '@tickets/ui';
import type { StatusKind } from '../api/types';
import { KIND_ICON, KIND_TONE, statusPill } from '../domain/status';

export type StatusOption = { key: string; label: string; kind: StatusKind };

type StatusSelectProps = {
  statuses: StatusOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Keys reachable from the current status per the workflow graph. Undefined = all allowed. */
  legalTargets?: string[];
  size?: FieldSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  disabled?: boolean;
  className?: string;
};

const PADDING: Record<FieldSize, string> = {
  sm: 'pr-8 pl-6',
  md: 'pr-8 pl-6',
  lg: 'pr-10 pl-8',
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
  size = 'md',
  tone,
  disabled,
  className,
}: StatusSelectProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
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
          className={fieldClass({
            size,
            state: field.state,
            scale: field.scale,
            className: cn(
              'flex w-full items-center justify-between gap-8',
              'disabled:pointer-events-none disabled:opacity-50',
              PADDING[size],
              className,
            ),
          })}
        >
          {current ? (
            <Pill {...statusPill(current.kind)} label={current.label} />
          ) : (
            <span className="pl-4 font-sans text-13/19 text-gray-9">Set status…</span>
          )}
          <span aria-hidden className="text-10 text-gray-9">
            <Icon name="chevron-down" size="sm" />
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
              <span className="inline-flex items-center gap-9">
                <span className="inline-flex">
                  <Icon name={KIND_ICON[kind]} tone={KIND_TONE[kind]} size="xs" />
                </span>
                <span className="font-sans text-13/19 text-gray-12">{option.label}</span>
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
