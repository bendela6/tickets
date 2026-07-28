import { useState } from 'react';
import { Button, Combobox, type ComboOption, Input, MultiCombobox, Pill, Popover, PopoverContent, PopoverTrigger } from '@tickets/ui';
import { KIND_TONE } from '../../domain/status';
import type { FilterRule } from '../../utils/view-config';
import type { GlobalFilterRule } from './global-views';
import type { SharedField } from './shared-fields';

const KINDS = ['todo', 'active', 'blocked', 'done', 'dropped'];

const OP_LABELS: Record<FilterRule['op'], string> = {
  'any-of': 'is',
  'none-of': 'is not',
  contains: 'contains',
  empty: 'is empty',
  'not-empty': 'is not empty',
  kinds: 'kind is',
};

function isOptionish(field: SharedField | null): boolean {
  return field !== null && field.type === 'option';
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
    return <span className="text-gray-12">“{rule.values[0] ?? ''}”</span>;
  }
  const field = sharedByKey.get(rule.fieldKey);
  return (
    <>
      {rule.values.map((value) => {
        if (rule.op === 'kinds') {
          return (
            <Pill
              key={value}
              label={value}
              tone={KIND_TONE[value as keyof typeof KIND_TONE] ?? 'gray'}
              shape="round"
              className="h-4.5"
            />
          );
        }
        const option = field?.options.find((candidate) => candidate.value === value);
        return (
          <Pill
            key={value}
            label={option?.label ?? value}
            tone={option?.color ?? 'gray'}
            shape="round"
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
          ...(selectedField?.workflow === true ? [{ value: 'kinds', label: 'kind of' }] : []),
        ]
      : [{ value: 'contains', label: 'contains' }]),
    { value: 'empty', label: 'is empty' },
    { value: 'not-empty', label: 'is not empty' },
  ];

  const valueOptions: ComboOption[] = !selectedField
    ? []
    : op === 'kinds'
      ? KINDS.map((kind) => ({
          value: kind,
          label: kind,
          color: KIND_TONE[kind as keyof typeof KIND_TONE] ?? 'gray',
        }))
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
          className="inline-flex h-7 cursor-pointer items-center gap-1.25 rounded-[7px] border border-dashed border-gray-7 px-2.5 font-sans text-12/17 font-500 text-gray-11 hover:text-gray-12"
        >
          ＋ Filter
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex w-64 flex-col gap-2 p-3">
          <Combobox
            size="sm"
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
              size="sm"
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
              size="sm"
              options={valueOptions}
              value={values}
              onChange={setValues}
              placeholder="Values…"
            />
          ) : null}
          {selectedField && op === 'contains' ? (
            <Input
              size="sm"
              placeholder="text…"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          ) : null}
          <div className="flex items-center justify-end gap-2 pt-0.5">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="solid"
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
            className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-gray-6 bg-surface-raised px-2.5 font-sans text-12/17 text-gray-11"
          >
            <strong className="font-500 text-gray-12">{field?.label ?? rule.fieldKey}</strong>
            {OP_LABELS[rule.op]}
            <RuleValues rule={rule} sharedByKey={sharedByKey} />
            <button
              type="button"
              aria-label="Remove filter"
              className="cursor-pointer text-gray-9 hover:text-gray-12"
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
          <span className="inline-flex items-center gap-2 font-sans text-12/17 text-gray-11">
            <span aria-hidden className="size-1.5 rounded-full bg-orange-9" />
            Unsaved changes
          </span>
          <Button size="sm" onClick={onSaveToView}>
            Save to view
          </Button>
          <button
            type="button"
            className="cursor-pointer font-sans text-12/17 font-500 text-gray-9 hover:text-gray-12"
            onClick={onReset}
          >
            Reset
          </button>
        </>
      ) : null}
    </div>
  );
}
