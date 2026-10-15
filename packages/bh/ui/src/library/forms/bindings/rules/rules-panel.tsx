import { FormProvider, NestedFields, useFormRegistry } from '@bh/form';
import type { Condition, FieldMeta, Filter } from '@bh/resource';
import { useEffect, useRef, useState } from 'react';
import { Drawer, DrawerControls } from '../../../overlays/components/drawer';
import { Icon } from '../../../primitives/components/icon';
import { conditionWords, entryWords } from './describe';
import { addButtonClass, EditorPopover } from './editor-popover';
import { fieldAt, isCondition, operatorsFor, wordsFor, type RulesMeta } from './meta';
import { operandInput } from './operand';
import { RemoveButton } from './rule-chip';
import { RuleEditor } from './rule-editor';
import type { FieldOptions } from './use-field-options';
import { ValueWrapper } from './value-wrapper';

// `add: 'panel'`: every rule as a row in a panel from the right edge, the
// field, its operator as a select and its value's input, with + Filter at the
// foot. A row is changed in place and applies as soon as it is whole; one
// whose new operator still wants a value applies nothing until it has one.

/** A rule as the panel holds it while it is open. */
type Row =
  /** A condition on a field the metadata names, changed in place. */
  | { id: number; kind: 'edit'; field: FieldMeta; op: string; input: unknown }
  /** Anything else, read in words and kept as it is: an attribute's rule, a group. */
  | { id: number; kind: 'fixed'; entry: Filter };

let lastId = 0;
const nextId = () => {
  lastId += 1;
  return lastId;
};

/** An entry as a row: in place if the panel can draw its operator, else in words. */
function toRow(meta: RulesMeta, entry: Filter): Row {
  const at = isCondition(entry) ? fieldAt(meta, entry.field) : undefined;
  const spec = isCondition(entry) ? meta.operators.get(entry.op) : undefined;
  if (
    !isCondition(entry) ||
    !at ||
    at.attribute ||
    !spec ||
    !operatorsFor(meta, at.field).some((each) => each.name === spec.name)
  ) {
    return { id: nextId(), kind: 'fixed', entry };
  }
  const input = operandInput(meta, at.field, spec);
  return {
    id: nextId(),
    kind: 'edit',
    field: at.field,
    op: entry.op,
    input: input?.toInput(entry.value),
  };
}

/** A row's condition; null while its value is still wanted. */
function conditionOf(meta: RulesMeta, row: Row & { kind: 'edit' }): Condition | null {
  const spec = meta.operators.get(row.op);
  if (!spec) {
    return null;
  }
  const input = operandInput(meta, row.field, spec);
  if (!input) {
    return { field: row.field.key, op: row.op };
  }
  const operand = input.toOperand(row.input);
  return operand === undefined ? null : { field: row.field.key, op: row.op, value: operand };
}

/** What the rows filter by: each whole one, in their order. */
function entriesOf(meta: RulesMeta, rows: readonly Row[]): Filter[] {
  return rows.flatMap((row) => {
    if (row.kind === 'fixed') {
      return [row.entry];
    }
    const condition = conditionOf(meta, row);
    return condition ? [condition] : [];
  });
}

const same = (a: readonly Filter[], b: readonly Filter[]) => {
  return JSON.stringify(a) === JSON.stringify(b);
};

export interface RulesPanelProps {
  meta: RulesMeta;
  options: FieldOptions;
  /** The rules, as the field holds them. */
  entries: readonly Filter[];
  /** The field's name, under which each row's inputs are named. */
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The rules, changed: a row made whole, changed, added or removed. */
  onChange: (next: Filter[]) => void;
}

/** Every rule as a row, in a panel from the right edge. */
export function RulesPanel({ open, onOpenChange, ...rest }: RulesPanelProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      label="Filters"
      side="right"
      size="md"
      minWidth={320}
      maxWidth={560}
    >
      {/* Mounted while open: the rows start from the rules each time it opens. */}
      <PanelBody {...rest} />
    </Drawer>
  );
}

function PanelBody({
  meta,
  options,
  entries,
  name,
  onChange,
}: Omit<RulesPanelProps, 'open' | 'onOpenChange'>) {
  const registry = useFormRegistry();
  const [rows, setRows] = useState<Row[]>(() => entries.map((entry) => toRow(meta, entry)));
  const [adding, setAdding] = useState(false);

  // Rules changed from outside the panel start its rows again; the panel's own
  // changes come back as what its rows already say.
  const said = useRef(entries);
  useEffect(() => {
    if (said.current !== entries && !same(entries, entriesOf(meta, rows))) {
      setRows(entries.map((entry) => toRow(meta, entry)));
    }
    said.current = entries;
  }, [entries]);

  const change = (next: Row[]) => {
    setRows(next);
    const filter = entriesOf(meta, next);
    if (!same(filter, entries)) {
      onChange(filter);
    }
  };

  const update = (id: number, patch: Partial<Pick<Row & { kind: 'edit' }, 'op' | 'input'>>) => {
    change(rows.map((row) => (row.id === id && row.kind === 'edit' ? { ...row, ...patch } : row)));
  };

  return (
    <>
      <div className="border-gray-6 flex shrink-0 items-center gap-8 border-b-1 px-16 py-10">
        {/* The drawer's own title names it; this one is for the eye. */}
        <span aria-hidden className="text-14 font-600 text-gray-12 flex-1">
          Filters
        </span>
        <DrawerControls />
      </div>
      <div className="flex flex-1 flex-col gap-12 overflow-y-auto px-16 py-12">
        {rows.length === 0 ? (
          <p className="text-12 text-gray-11">No filters yet. Every filter you add must match.</p>
        ) : null}
        {rows.map((row) => {
          if (row.kind === 'fixed') {
            const words = entryWords(meta, row.entry, options.titles);
            return (
              <div
                key={row.id}
                role="group"
                aria-label={words}
                className="border-gray-5 flex items-start gap-8 border-b-1 pb-12"
              >
                <p className="text-12 text-gray-11 flex-1 py-2">{words}</p>
                <RemoveButton
                  words={words}
                  onRemove={() => change(rows.filter((each) => each.id !== row.id))}
                />
              </div>
            );
          }
          const specs = operatorsFor(meta, row.field);
          const spec = specs.find((each) => each.name === row.op);
          const opWords = spec ? wordsFor(spec, row.field) : row.op;
          const input = spec
            ? operandInput(meta, row.field, spec, options.of(row.field) ?? [])
            : null;
          const condition = conditionOf(meta, row);
          const words = condition
            ? conditionWords(meta, condition, options.titles)
            : `${row.field.label} ${opWords}`;
          const at = `${name}.panel.${row.id}`;
          return (
            <div
              key={row.id}
              role="group"
              aria-label={words}
              className="border-gray-5 flex flex-col gap-6 border-b-1 pb-12"
            >
              <div className="flex h-24 items-center justify-between gap-8">
                <span className="text-12 font-600 text-gray-12">{row.field.label}</span>
                <RemoveButton
                  words={words}
                  onRemove={() => change(rows.filter((each) => each.id !== row.id))}
                />
              </div>
              <FormProvider registry={{ ...registry, field: { Component: ValueWrapper } }}>
                <div className="flex flex-wrap items-start gap-8">
                  <div className="w-160 shrink-0">
                    <NestedFields
                      name={at}
                      nodes={[
                        {
                          kind: 'field',
                          name: 'op',
                          type: 'select',
                          label: `${row.field.label} operator`,
                          config: {
                            options: specs.map((each) => {
                              return { value: each.name, label: wordsFor(each, row.field) };
                            }),
                          },
                        },
                      ]}
                      value={{ op: row.op }}
                      onChange={(next) => {
                        const op = next.op;
                        if (typeof op !== 'string' || op === row.op) {
                          return;
                        }
                        const was = input;
                        const nextSpec = meta.operators.get(op);
                        const drawn = nextSpec ? operandInput(meta, row.field, nextSpec) : null;
                        // The value stays while the new operator draws the same input.
                        update(row.id, {
                          op,
                          input:
                            drawn && was?.type === drawn.type
                              ? row.input
                              : drawn?.toInput(undefined),
                        });
                      }}
                    />
                  </div>
                  {input ? (
                    <div className="min-w-160 flex-1">
                      <NestedFields
                        name={at}
                        nodes={[
                          {
                            kind: 'field',
                            name: 'value',
                            type: input.type,
                            label: `${row.field.label} ${opWords}`,
                            config: input.config,
                          },
                        ]}
                        value={{ value: row.input }}
                        onChange={(next) => update(row.id, { input: next.value })}
                      />
                    </div>
                  ) : null}
                </div>
              </FormProvider>
              {condition ? null : (
                <p className="text-11 text-gray-10">Applies nothing until it has a value.</p>
              )}
            </div>
          );
        })}
        <div>
          <EditorPopover
            open={adding}
            onOpenChange={setAdding}
            label="Add a filter"
            trigger={
              <button type="button" className={addButtonClass}>
                <Icon name="plus" size="xs" />
                Filter
              </button>
            }
          >
            <RuleEditor
              meta={meta}
              options={options}
              name={`${name}.panel.new`}
              onDone={(rule) => {
                change([...rows, toRow(meta, rule)]);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </EditorPopover>
        </div>
      </div>
    </>
  );
}
