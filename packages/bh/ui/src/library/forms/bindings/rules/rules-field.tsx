import type { InputProps } from '@bh/form';
import {
  createKindRegistry,
  createOperatorRegistry,
  type FieldMeta,
  type Filter,
  type KindRegistry,
  type OperatorRegistry,
} from '@bh/resource';
import { useEffect, useRef, useState } from 'react';
import { cn, focusRing } from '../../../../style';
import { disabledTreatment } from '../../../inputs/contract';
import { Button } from '../../../primitives/components/button';
import { Icon } from '../../../primitives/components/icon';
import type { InputKind } from '../../registry';
import { conditionWords, entryWords, groupParts, partsOf } from './describe';
import { addButtonClass, EditorPopover } from './editor-popover';
import { fieldAt, isCondition, type RuleOption, type RulesMeta } from './meta';
import { GroupChip, RuleChip } from './rule-chip';
import { RuleEditor } from './rule-editor';
import { RulesPanel } from './rules-panel';
import { useInlineRow } from '../../inline-row';
import { useFieldOptions } from './use-field-options';

export interface RulesFieldConfig {
  /**
   * How a rule is added: `'chips'`, a "+ Filter" that opens three steps beside
   * the chips; or `'panel'`, a "Filters" button that opens every rule as a row
   * in a side panel. Stored with the form.
   */
  add?: 'chips' | 'panel';
  /** The input an app's own operator's value is drawn with, by the operator's name. */
  operatorInputs?: Readonly<Record<string, InputKind>>;
  /** The fields a rule may name; a filter form gives those whose `query.filter` isn't empty. */
  fields?: readonly FieldMeta[];
  /** The operators they're filtered by; bh's fifteen when none is given. */
  operators?: OperatorRegistry;
  /** The kinds they're of; bh's fifteen when none is given. */
  kinds?: KindRegistry;
  /** The rows a ref field may hold, by their titles. */
  optionsFor?: (field: FieldMeta) => Promise<RuleOption[]>;
  /** Accessible name for the rules. Falls back to the field's label, then its name. */
  label?: string;
}

// bh's own, for a rules field given none.
const OPERATORS = createOperatorRegistry();
const KINDS = createKindRegistry([], OPERATORS);

/**
 * A filter's rules: one chip per condition, each read in words, and ways to
 * add one. Its value is the conditions, each joined to the rest by `all`;
 * an `any` or `not` group, which a filter form never writes, is kept as it is.
 */
export function RulesField(p: InputProps<RulesFieldConfig, Filter[]>) {
  const entries = p.value ?? [];
  const meta: RulesMeta = {
    fields: p.config.fields ?? [],
    operators: p.config.operators ?? OPERATORS,
    kinds: p.config.kinds ?? KINDS,
    ...(p.config.operatorInputs ? { operatorInputs: p.config.operatorInputs } : {}),
    ...(p.config.optionsFor ? { optionsFor: p.config.optionsFor } : {}),
  };
  const options = useFieldOptions(meta, entries);
  const readOnly = p.readOnly ?? false;
  const disabled = (p.disabled ?? false) || p.loading;
  // The rule whose editor is open, by its place; 'new' for + Filter's; 'panel' for the side panel.
  const [open, setOpen] = useState<number | 'new' | 'panel' | null>(null);
  // In a row that collapses, the chips past its count wait behind "+3 more".
  const collapse = useInlineRow()?.collapse;
  const [expanded, setExpanded] = useState(false);
  const hidden = collapse === undefined || expanded ? 0 : Math.max(0, entries.length - collapse);

  const commit = (next: Filter[]) => {
    if (!readOnly && !disabled) {
      p.onChange(next);
    }
  };

  // A chip's ×, pressed, takes its chip away and the focus with it: the
  // focus goes to the × of the chip that takes its place, or of the one
  // before it, or else to the way to add one. Once the value has lost it.
  const group = useRef<HTMLDivElement>(null);
  const removed = useRef<{ place: number; from: number } | null>(null);
  useEffect(() => {
    const pending = removed.current;
    if (!pending || entries.length >= pending.from) {
      return;
    }
    removed.current = null;
    const root = group.current;
    const removes = root?.querySelectorAll<HTMLElement>('[data-remove]') ?? [];
    const next =
      removes[Math.min(pending.place, removes.length - 1)] ??
      root?.querySelector<HTMLElement>('button:not(:disabled)');
    next?.focus();
  }, [entries.length]);

  return (
    <div
      ref={group}
      id={p.name}
      aria-describedby={p.describedBy}
      role="group"
      aria-label={p.config.label ?? p.label ?? p.name}
      aria-disabled={disabled || undefined}
      onBlur={p.onBlur}
      className={cn('flex flex-wrap items-center gap-6', disabled && disabledTreatment)}
    >
      {readOnly || p.config.add !== 'panel' ? null : (
        <>
          <Button
            variant="outline"
            tone="neutral"
            size="sm"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open === 'panel'}
            // The badge is a digit on screen; said, it is a phrase.
            aria-label={
              entries.length > 0
                ? `Filters, ${entries.length} ${entries.length === 1 ? 'filter' : 'filters'}`
                : 'Filters'
            }
            onClick={() => setOpen('panel')}
          >
            <Icon name="filter" size="sm" />
            Filters
            {entries.length > 0 ? (
              <span className="rounded-8 bg-indigo-9 text-11 px-6 font-mono leading-16 text-white">
                {entries.length}
              </span>
            ) : null}
          </Button>
          <RulesPanel
            meta={meta}
            options={options}
            entries={entries}
            name={p.name}
            open={open === 'panel'}
            onOpenChange={(next) => setOpen(next ? 'panel' : null)}
            onChange={commit}
          />
        </>
      )}
      {entries.map((entry, index) => {
        if (hidden > 0 && index >= entries.length - hidden) {
          return null;
        }
        const remove = () => {
          removed.current = { place: index, from: entries.length };
          commit(entries.filter((_, place) => place !== index));
        };
        if (!isCondition(entry)) {
          // A group a view or the API wrote: read in words, kept as it is.
          const words = entryWords(meta, entry, options.titles);
          return (
            <GroupChip
              key={`${index}:${words}`}
              {...groupParts(meta, entry, options.titles)}
              words={words}
              readOnly={readOnly}
              onRemove={remove}
            />
          );
        }
        const words = conditionWords(meta, entry, options.titles);
        // An attribute's rule ('status.kind') is a preset's: read, never opened.
        const at = fieldAt(meta, entry.field);
        const editable = at !== undefined && at.attribute === undefined && !disabled;
        return (
          <RuleChip
            // A rule's place and words: two rules alike are one rule twice.
            key={`${index}:${words}`}
            {...partsOf(meta, entry, options.titles)}
            words={words}
            readOnly={readOnly}
            onRemove={remove}
            body={
              editable
                ? (parts) => {
                    return (
                      <EditorPopover
                        open={open === index}
                        onOpenChange={(next) => setOpen(next ? index : null)}
                        label={`Edit filter: ${words}`}
                        trigger={
                          <button
                            type="button"
                            aria-label={`Edit filter: ${words}`}
                            className={cn(
                              'rounded-3 -my-2 -ml-4 inline-flex items-center gap-5 py-2 pl-4',
                              focusRing('indigo', 'focus-visible', 'inward'),
                            )}
                          >
                            {parts}
                          </button>
                        }
                      >
                        <RuleEditor
                          meta={meta}
                          options={options}
                          rule={entry}
                          name={`${p.name}.${index}`}
                          onDone={(rule) => {
                            commit(entries.map((each, place) => (place === index ? rule : each)));
                            setOpen(null);
                          }}
                          onCancel={() => setOpen(null)}
                        />
                      </EditorPopover>
                    );
                  }
                : undefined
            }
          />
        );
      })}
      {collapse !== undefined && entries.length > collapse ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'rounded-5 border-gray-6 bg-gray-2 text-12 font-500 text-gray-12 hover:bg-gray-3 border-1.5 inline-flex h-28 items-center px-9 font-sans',
            focusRing('indigo', 'focus-visible'),
          )}
        >
          {expanded ? 'Fewer' : `+${hidden} more`}
        </button>
      ) : null}
      {readOnly || p.config.add === 'panel' ? null : (
        <EditorPopover
          open={open === 'new'}
          onOpenChange={(next) => setOpen(next ? 'new' : null)}
          label="Add a filter"
          trigger={
            <button type="button" disabled={disabled} className={addButtonClass}>
              <Icon name="plus" size="xs" />
              Filter
            </button>
          }
        >
          <RuleEditor
            meta={meta}
            options={options}
            name={`${p.name}.new`}
            onDone={(rule) => {
              commit([...entries, rule]);
              setOpen(null);
            }}
            onCancel={() => setOpen(null)}
          />
        </EditorPopover>
      )}
    </div>
  );
}
