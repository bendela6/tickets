import { useState } from 'react';
import { Pill } from '@tickets/ui/pill';
import type { Board, Field, Option } from '../../api/types';
import { KIND_TONE } from '../../domain/status';
import { hexToOptionColor, kindColor } from '../../registry/option-color';
import { Button } from '../../ui/button';
import type { ComboOption } from '../../ui/combobox-list';
import { Combobox } from '../../ui/combobox';
import { Input } from '../../ui/input';
import { MultiCombobox } from '../../ui/multi-combobox';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import type { BoardIndexes } from '../../utils/index-board';
import type { FilterRule } from '../../utils/view-config';

// Field-level options list, unscoped by type (filters are project-wide, not
// bound to one item type's allowlist) — the type-scoped equivalent is
// indexes.optionsForField.
function optionsInSet(field: Field, indexes: BoardIndexes): Option[] {
  return field.optionSetId === null ? [] : (indexes.optionsBySetId.get(field.optionSetId) ?? []);
}

const KINDS = ['todo', 'active', 'blocked', 'done', 'dropped'];

const OP_LABELS: Record<FilterRule['op'], string> = {
  'any-of': 'is',
  'none-of': 'is not',
  contains: 'contains',
  empty: 'is empty',
  'not-empty': 'is not empty',
  kinds: 'kind is',
};

function isOptionish(field: Field | null): boolean {
  return field !== null && field.type === 'option';
}

/** Value chips for one rule: option/status labels with their palette color. */
function RuleValues({ rule, indexes }: { rule: FilterRule; indexes: BoardIndexes }) {
  const field = indexes.fieldByKey.get(rule.fieldKey);
  if (rule.op === 'empty' || rule.op === 'not-empty') {
    return null;
  }
  if (rule.op === 'contains') {
    return <span className="text-ink">“{rule.values[0] ?? ''}”</span>;
  }
  return (
    <>
      {rule.values.map((value) => {
        if (rule.op === 'kinds') {
          return (
            <Pill
              key={value}
              label={value}
              tone={KIND_TONE[value as keyof typeof KIND_TONE] ?? 'gray'}
              shape="full"
              className="h-4.5"
            />
          );
        }
        if (field?.config.workflow === true) {
          const option = indexes.optionByValue(field, value);
          return (
            <Pill
              key={value}
              label={option?.label ?? value}
              tone={kindColor(option?.kind ?? null)}
              shape="full"
              className="h-4.5"
            />
          );
        }
        const option = field
          ? optionsInSet(field, indexes).find((candidate) => candidate.value === value)
          : undefined;
        return (
          <Pill
            key={value}
            label={option?.label ?? value}
            tone={hexToOptionColor(option?.config.color)}
            shape="full"
            className="h-4.5"
          />
        );
      })}
    </>
  );
}

/** The "＋ Filter" popover: field → operator → value(s), then Add. */
function AddFilter({
  board,
  indexes,
  onAdd,
}: {
  board: Board;
  indexes: BoardIndexes;
  onAdd: (rule: FilterRule) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const [op, setOp] = useState<FilterRule['op']>('any-of');
  const [values, setValues] = useState<string[]>([]);
  const [text, setText] = useState('');

  const selectedField = fieldKey === null ? null : (indexes.fieldByKey.get(fieldKey) ?? null);
  const optionish = isOptionish(selectedField);

  const fieldOptions: ComboOption[] = board.fields
    .filter((field) => !field.archivedAt)
    .map((field) => ({ value: field.key, label: field.label }));

  const opOptions: ComboOption[] = [
    ...(optionish
      ? [
          { value: 'any-of', label: 'is any of' },
          { value: 'none-of', label: 'is none of' },
          ...(selectedField?.config.workflow === true
            ? [{ value: 'kinds', label: 'kind of' }]
            : []),
        ]
      : [{ value: 'contains', label: 'contains' }]),
    { value: 'empty', label: 'is empty' },
    { value: 'not-empty', label: 'is not empty' },
  ];

  const valueOptions: ComboOption[] = !selectedField
    ? []
    : selectedField.config.workflow === true
      ? op === 'kinds'
        ? KINDS.map((kind) => ({
            value: kind,
            label: kind,
            color: KIND_TONE[kind as keyof typeof KIND_TONE] ?? 'gray',
          }))
        : optionsInSet(selectedField, indexes).map((option) => ({
            value: option.value,
            label: option.label,
            color: kindColor(option.kind),
          }))
      : optionsInSet(selectedField, indexes).map((option) => ({
          value: option.value,
          label: option.label,
          color: hexToOptionColor(option.config.color),
        }));

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
              const nextField = next === null ? null : (indexes.fieldByKey.get(next) ?? null);
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

// Filter row per docs/design/03-project-board.html lines 108–114: each rule is
// a raised chip (field · op · value pills · ×), "＋ Filter" is a dashed chip,
// count sits right. Ad-hoc edits live in the URL until saved into the view.
export function FilterChips({
  board,
  indexes,
  rules,
  dirty,
  shown,
  total,
  onRulesChange,
  onSaveToView,
}: {
  board: Board;
  indexes: BoardIndexes;
  rules: FilterRule[];
  dirty: boolean;
  shown: number;
  total: number;
  onRulesChange: (next: FilterRule[]) => void;
  onSaveToView: () => void;
}) {
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
      {rules.map((rule, index) => {
        const field = indexes.fieldByKey.get(rule.fieldKey);
        return (
          <span
            key={index}
            className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-hairline bg-raised px-2.5 font-sans text-meta text-ink-2"
          >
            <strong className="font-medium text-ink">
              {field?.label ?? rule.fieldKey}
            </strong>
            {OP_LABELS[rule.op]}
            <RuleValues rule={rule} indexes={indexes} />
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
      <AddFilter
        board={board}
        indexes={indexes}
        onAdd={(rule) => onRulesChange([...rules, rule])}
      />
      {dirty ? (
        <button
          type="button"
          className="cursor-pointer font-sans text-meta font-medium text-accent hover:underline"
          onClick={onSaveToView}
        >
          save to view
        </button>
      ) : null}
      <span className="flex-1" />
      <span className="font-mono text-meta text-ink-3">
        {shown} of {total} in view
      </span>
    </div>
  );
}
