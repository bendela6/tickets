import { useState } from 'react';
import { Button } from '../../ui/button';
import { Combobox } from '../../ui/combobox';
import type { ComboOption } from '../../ui/combobox-list';
import { Input } from '../../ui/input';
import { MultiCombobox } from '../../ui/multi-combobox';
import { OptionChip, type OptionColor } from '../../ui/option-chip';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import type { FilterRule } from '../../utils/view-config';
import type { GlobalFilterRule } from './global-views';
import type { SharedField } from './shared-fields';

const KINDS = ['todo', 'active', 'blocked', 'done', 'dropped'];

const KIND_COLORS: Record<string, OptionColor> = {
  todo: 'gray',
  active: 'blue',
  blocked: 'orange',
  done: 'green',
  dropped: 'gray',
};

const OP_LABELS: Record<FilterRule['op'], string> = {
  'any-of': 'is',
  'none-of': 'is not',
  contains: 'contains',
  empty: 'is empty',
  'not-empty': 'is not empty',
  kinds: 'kind is',
};

function isOptionish(field: SharedField | null): boolean {
  return (
    field !== null &&
    (field.type === 'select' || field.type === 'multi_select' || field.type === 'status')
  );
}

/** Value chips for one rule, resolved through the shared field's option union. */
function RuleValues({
  rule,
  sharedByKey,
}: {
  rule: GlobalFilterRule;
  sharedByKey: Map<string, SharedField>;
}) {
  if (rule.op === 'empty' || rule.op === 'not-empty') {
    return null;
  }
  if (rule.op === 'contains') {
    return <span className="text-ink">“{rule.values[0] ?? ''}”</span>;
  }
  const field = sharedByKey.get(rule.fieldKey);
  return (
    <>
      {rule.values.map((value) => {
        if (rule.op === 'kinds') {
          return (
            <OptionChip
              key={value}
              label={value}
              color={KIND_COLORS[value] ?? 'gray'}
              className="h-4.5"
            />
          );
        }
        const option = field?.options.find((candidate) => candidate.value === value);
        return (
          <OptionChip
            key={value}
            label={option?.label ?? value}
            color={option?.color ?? 'gray'}
            className="h-4.5"
          />
        );
      })}
    </>
  );
}

/** The "＋ Filter" popover over shared fields: field → operator → value(s) → Add. */
function AddFilter({
  sharedFields,
  onAdd,
}: {
  sharedFields: SharedField[];
  onAdd: (rule: GlobalFilterRule) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const [op, setOp] = useState<FilterRule['op']>('any-of');
  const [values, setValues] = useState<string[]>([]);
  const [text, setText] = useState('');

  const selectedField =
    fieldKey === null
      ? null
      : (sharedFields.find((candidate) => candidate.key === fieldKey) ?? null);
  const optionish = isOptionish(selectedField);

  const fieldOptions: ComboOption[] = sharedFields.map((field) => ({
    value: field.key,
    label: field.label,
  }));

  const opOptions: ComboOption[] = [
    ...(optionish
      ? [
          { value: 'any-of', label: 'is any of' },
          { value: 'none-of', label: 'is none of' },
          ...(selectedField?.type === 'status' ? [{ value: 'kinds', label: 'kind of' }] : []),
        ]
      : [{ value: 'contains', label: 'contains' }]),
    { value: 'empty', label: 'is empty' },
    { value: 'not-empty', label: 'is not empty' },
  ];

  const valueOptions: ComboOption[] = !selectedField
    ? []
    : op === 'kinds'
      ? KINDS.map((kind) => ({ value: kind, label: kind, color: KIND_COLORS[kind] ?? 'gray' }))
      : selectedField.options;

  const needsValues = op === 'any-of' || op === 'none-of' || op === 'kinds';
  const valid =
    selectedField !== null &&
    (needsValues ? values.length > 0 : op === 'contains' ? text.length > 0 : true);

  const reset = () => {
    setFieldKey(null);
    setOp('any-of');
    setValues([]);
    setText('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 cursor-pointer items-center gap-1.25 rounded-[7px] border border-dashed border-control px-2.5 font-sans text-meta font-medium text-ink-2 hover:text-ink"
        >
          ＋ Filter
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex w-64 flex-col gap-2 p-3">
          <Combobox
            size="compact"
            options={fieldOptions}
            value={fieldKey}
            placeholder="Field…"
            onChange={(next) => {
              setFieldKey(next);
              const nextField =
                next === null
                  ? null
                  : (sharedFields.find((candidate) => candidate.key === next) ?? null);
              setOp(isOptionish(nextField) ? 'any-of' : 'contains');
              setValues([]);
              setText('');
            }}
          />
          {selectedField ? (
            <Combobox
              size="compact"
              options={opOptions}
              value={op}
              onChange={(next) => {
                if (next !== null) {
                  setOp(next as FilterRule['op']);
                  setValues([]);
                }
              }}
            />
          ) : null}
          {selectedField && needsValues ? (
            <MultiCombobox
              size="compact"
              options={valueOptions}
              value={values}
              onChange={setValues}
              placeholder="Values…"
            />
          ) : null}
          {selectedField && op === 'contains' ? (
            <Input
              size="compact"
              placeholder="text…"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          ) : null}
          <div className="flex items-center justify-end gap-2 pt-0.5">
            <Button size="compact" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="compact"
              variant="primary"
              disabled={!valid}
              onClick={() => {
                if (!selectedField) {
                  return;
                }
                onAdd({
                  fieldKey: selectedField.key,
                  op,
                  values: op === 'contains' ? [text] : needsValues ? values : [],
                });
                setOpen(false);
                reset();
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Filter row per docs/design/02-all-tickets.html lines 101–109: rule chips +
// dashed "＋ Filter" like the project board's, with the unsaved-dot, "Save to
// view" and "Reset" cluster at the right when the working state has drifted
// from the active global view.
export function GlobalFilterChips({
  sharedFields,
  rules,
  dirty,
  onRulesChange,
  onSaveToView,
  onReset,
}: {
  sharedFields: SharedField[];
  rules: GlobalFilterRule[];
  dirty: boolean;
  onRulesChange: (next: GlobalFilterRule[]) => void;
  onSaveToView: () => void;
  onReset: () => void;
}) {
  const sharedByKey = new Map(sharedFields.map((field) => [field.key, field]));
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
      {rules.map((rule, index) => {
        const field = sharedByKey.get(rule.fieldKey);
        return (
          <span
            key={index}
            className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-hairline bg-raised px-2.5 font-sans text-meta text-ink-2"
          >
            <strong className="font-medium text-ink">{field?.label ?? rule.fieldKey}</strong>
            {OP_LABELS[rule.op]}
            <RuleValues rule={rule} sharedByKey={sharedByKey} />
            <button
              type="button"
              aria-label="Remove filter"
              className="cursor-pointer text-ink-3 hover:text-ink"
              onClick={() => onRulesChange(rules.filter((candidate) => candidate !== rule))}
            >
              ×
            </button>
          </span>
        );
      })}
      <AddFilter sharedFields={sharedFields} onAdd={(rule) => onRulesChange([...rules, rule])} />
      <span className="flex-1" />
      {dirty ? (
        <>
          <span className="inline-flex items-center gap-2 font-sans text-meta text-ink-2">
            <span aria-hidden className="size-1.5 rounded-full bg-kind-blocked" />
            Unsaved changes
          </span>
          <Button size="compact" onClick={onSaveToView}>
            Save to view
          </Button>
          <button
            type="button"
            className="cursor-pointer font-sans text-meta font-medium text-ink-3 hover:text-ink"
            onClick={onReset}
          >
            Reset
          </button>
        </>
      ) : null}
    </div>
  );
}
