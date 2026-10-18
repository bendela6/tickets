import { FormProvider, NestedFields, useFormRegistry } from '@bh/form';
import type { Condition, FieldMeta, OperatorSpec } from '@bh/resource';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn, focusRing } from '../../../../style';
import { Button } from '../../../primitives/components/button';
import { Icon, type IconName } from '../../../primitives/components/icon';
import { ComboboxList } from '../../../inputs/parts/combobox-list';
import { fieldAt, filterable, kindLabel, operatorsFor, wordsFor, type RulesMeta } from './meta';
import { operandInput, type Operand } from './operand';
import type { FieldOptions } from './use-field-options';
import { ValueWrapper } from './value-wrapper';

// + Filter, in three steps in one popover: a field the metadata lets you
// filter on, an operator that field allows in its words, then the value, drawn
// by the registered input a form draws for it. The rule is a draft until Add.

/** Where the editor is: choosing a field, its operator, or the value. */
type Step =
  | { at: 'field' }
  | { at: 'op'; field: FieldMeta }
  | { at: 'value'; field: FieldMeta; spec: OperatorSpec };

// A glyph per kind for the field list, a registry icon or a mark in mono.
const GLYPHS: Record<string, IconName | string> = {
  option: 'circle-half',
  date: 'calendar',
  datetime: 'calendar',
  time: 'clock',
  boolean: 'circle-check',
  url: 'link',
  file: 'file',
  number: '12',
  email: '@',
  phone: '#',
  json: '{}',
};

function Glyph({ field }: { field: FieldMeta }) {
  const glyph =
    field.type.kind === 'ref'
      ? field.type.settings?.of === 'users'
        ? 'user'
        : 'link'
      : (GLYPHS[field.type.kind] ?? 'Aa');
  // One width for an icon and a mark, so the labels after them line up.
  return (
    <span
      aria-hidden
      className="text-10 text-gray-10 inline-flex w-16 shrink-0 justify-center font-mono"
    >
      {glyph.length > 2 ? <Icon name={glyph as IconName} size="xs" /> : glyph}
    </span>
  );
}

/** A step's head: back to the one before, and what has been chosen. */
function Head({ back, label, children }: { back: () => void; label: string; children: ReactNode }) {
  return (
    <div className="border-gray-5 text-13 border-b-1.5 flex items-center gap-6 px-8 py-6">
      <button
        type="button"
        aria-label={label}
        onClick={back}
        className={cn(
          'rounded-4 text-gray-11 hover:bg-gray-4 hover:text-gray-12 inline-flex size-24 shrink-0 items-center justify-center',
          focusRing('indigo', 'focus-visible', 'inward'),
        )}
      >
        <Icon name="chevron-left" size="sm" />
      </button>
      {children}
    </div>
  );
}

export interface RuleEditorProps {
  meta: RulesMeta;
  /** The rows of the ref fields, loaded as a field is chosen. */
  options: FieldOptions;
  /** The rule being changed, which the editor opens at its operator; none for a new one. */
  rule?: Condition;
  /** The field this editor's value is drawn under, as a nested field's name. */
  name: string;
  /** The rule, made: Add, or Save for one being changed. */
  onDone: (rule: Condition) => void;
  /** Drops the draft. */
  onCancel: () => void;
}

/** A new rule's three steps, or a rule's own from its operator on. */
export function RuleEditor({ meta, options, rule, name, onDone, onCancel }: RuleEditorProps) {
  const registry = useFormRegistry();
  const editing = rule ? fieldAt(meta, rule.field) : undefined;
  const [step, setStep] = useState<Step>(() => {
    return editing && !editing.attribute ? { at: 'op', field: editing.field } : { at: 'field' };
  });
  const [draft, setDraft] = useState<unknown>(undefined);
  const body = useRef<HTMLDivElement>(null);

  const field = step.at === 'field' ? undefined : step.field;
  const spec = step.at === 'value' ? step.spec : undefined;
  const input = field && spec ? operandInput(meta, field, spec, options.of(field) ?? []) : null;
  const operand: Operand | undefined = input ? input.toOperand(draft) : undefined;
  const complete = Boolean(spec) && (input === null || operand !== undefined);

  // The value step starts in its input, as the lists before it start in theirs.
  const valueStep = step.at === 'value';
  useEffect(() => {
    if (valueStep) {
      body.current
        ?.querySelector<HTMLElement>('input, textarea, button, [tabindex]:not([tabindex="-1"])')
        ?.focus();
    }
  }, [valueStep]);

  const choose = (next: OperatorSpec, on: FieldMeta) => {
    const was = rule?.field === on.key ? rule : undefined;
    const drawn = operandInput(meta, on, next, options.of(on) ?? []);
    // A rule being changed keeps its value while the new operator draws the same input.
    const before = was
      ? operandInput(meta, on, meta.operators.has(was.op) ? meta.operators.get(was.op) : next)
      : null;
    setDraft(
      drawn && before?.type === drawn.type ? drawn.toInput(was?.value) : drawn?.toInput(undefined),
    );
    setStep({ at: 'value', field: on, spec: next });
  };

  const done = () => {
    if (!field || !spec || !complete) {
      return;
    }
    onDone({
      field: field.key,
      op: spec.name,
      ...(operand === undefined ? {} : { value: operand }),
    });
  };

  // Enter in a box the value is typed into adds the rule, as a form's would
  // submit; a picker's own Enter opens it.
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      event.key === 'Enter' &&
      target instanceof HTMLInputElement &&
      !target.getAttribute('role')
    ) {
      event.preventDefault();
      done();
    }
  };

  if (step.at === 'field') {
    const fields = filterable(meta);
    return (
      <ComboboxList
        options={fields.map((each) => ({ value: each.key, label: each.label }))}
        isSelected={(key) => key === rule?.field}
        onPick={(key) => {
          const picked = fields.find((each) => each.key === key);
          if (picked) {
            options.load(picked);
            setStep({ at: 'op', field: picked });
          }
        }}
        keepOpen
        searchPlaceholder="Filter by…"
        label="Fields"
        renderLeading={(option) => {
          const picked = fields.find((each) => each.key === option.value);
          return picked ? <Glyph field={picked} /> : null;
        }}
        renderTrailing={(option) => {
          const picked = fields.find((each) => each.key === option.value);
          return picked ? (
            <span className="text-11 text-gray-10 shrink-0">{kindLabel(picked)}</span>
          ) : null;
        }}
        emptyLabel="No field to filter on"
        className="w-full"
      />
    );
  }

  if (step.at === 'op') {
    const on = step.field;
    const specs = operatorsFor(meta, on);
    return (
      <div className="flex flex-col">
        <Head back={() => setStep({ at: 'field' })} label="Back to fields">
          <span className="font-600">{on.label}</span>
          <span className="text-11 text-gray-10">{kindLabel(on)}</span>
        </Head>
        <ComboboxList
          options={specs.map((each) => ({ value: each.name, label: wordsFor(each, on) }))}
          isSelected={(name) => rule?.field === on.key && rule.op === name}
          onPick={(name) => {
            const next = specs.find((each) => each.name === name);
            if (next) {
              choose(next, on);
            }
          }}
          keepOpen
          searchable={false}
          label="Operator"
          renderTrailing={(option) => {
            return <code className="text-10 text-gray-10 shrink-0 font-mono">{option.value}</code>;
          }}
          className="w-full"
        />
      </div>
    );
  }

  const on = step.field;
  const words = wordsFor(step.spec, on);
  return (
    <div className="flex flex-col" onKeyDown={onKeyDown}>
      <Head back={() => setStep({ at: 'op', field: on })} label="Back to operators">
        <span className="font-600">{on.label}</span>
        <span className="text-gray-11">{words}</span>
      </Head>
      <div ref={body} className="p-8">
        {input ? (
          <FormProvider registry={{ ...registry, field: { Component: ValueWrapper } }}>
            <NestedFields
              name={name}
              nodes={[
                {
                  kind: 'field',
                  name: 'value',
                  type: input.type,
                  label: `${on.label} ${words}`,
                  config: input.config,
                },
              ]}
              value={{ value: draft }}
              onChange={(next) => setDraft(next.value)}
            />
          </FormProvider>
        ) : (
          <p className="text-12 text-gray-11 px-4">Nothing to choose: the rule is whole.</p>
        )}
      </div>
      <div className="border-gray-5 border-t-1.5 flex items-center justify-end gap-6 px-8 py-6">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="solid" size="sm" disabled={!complete} onClick={done}>
          {rule ? 'Save' : 'Add'}
        </Button>
      </div>
    </div>
  );
}
