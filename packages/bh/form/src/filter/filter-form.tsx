import {
  createContext,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useSelector } from '@tanstack/react-form';
import type { FieldPath, Filter, KindRegistry, OperatorRegistry, ResourceMeta } from '@bh/resource';
import type { ActionNode, ResetOptions } from '../types/action-node';
import type { CommitChange } from '../types/commit';
import type { FormConfig } from '../types/form-config';
import type {
  ActionProps,
  AnyInputs,
  FormRegistry,
  InputRegistry,
  LayoutComponentRegistry,
} from '../types/registry';
import { collectVisibleFields } from '../runtime/collect-visible-fields';
import { sameValues } from '../runtime/commits';
import { Form } from '../runtime/Form';
import { useRegistryOf } from '../runtime/form-provider';
import { type FormApi, useStandaloneForm } from '../runtime/use-standalone-form';
import { formStore } from '../utils/form-store';
import { addOnce, entriesOf, type FilterField, type FilterOptions, sameFilter } from './conditions';
import { countAsks } from './counts';
import { type AnyNodes, filterFields, type FilterQuery, foldFilter } from './fold';
import { fillFilterForm, type FilterOption } from './meta';
import { narrowOf, narrowSpec, SHEET_SLOT } from './narrow';
import { dropShared } from './shared';
import { spreadFilter } from './spread';

/** What a filter form shows: the query's own `search` and `filter`, as the address holds them. */
export interface FilterValue {
  /** What the field named `search` holds. */
  search?: string;
  /** The conditions, in one `all` as a filter form writes them, or any filter. */
  filter?: Filter;
}

/** `FilterForm`'s props. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FilterFormProps<I extends InputRegistry, L extends LayoutComponentRegistry = {}> {
  /**
   * The filters: fields that each hold a part of the filter (their `filter`),
   * in layouts, with the form's buttons and slots. A submit in it makes the
   * form apply with that button; without one, each change applies at once.
   */
  form: FormConfig<I, L>;
  /**
   * The filter it shows, as the address holds it. A new one, after Back,
   * puts the fields there without calling `onChange`.
   */
  value: FilterValue;
  /**
   * Called with the new `{ search, filter }`, which passes straight into a
   * query: at each change, or on submit in a form with a submit.
   */
  onChange: (next: FilterQuery) => void;
  /** What the form's slots hold: `end`, after the fields, the app's own. */
  slots?: { end?: ReactNode };
  /**
   * The resource's metadata. Each field takes its label and options from the
   * field its `filter` names, and a `filter` it doesn't allow is an error.
   */
  meta: ResourceMeta;
  /** The operators its fields are filtered by: bh's and the app's own. */
  operators: OperatorRegistry;
  /** The kinds its fields are of: bh's and the app's own. */
  kinds: KindRegistry;
  /** A ref field's rows, from the resource it names: the first page of those matching `text`. */
  optionsFor?: (resource: string, text: string) => Promise<FilterOption[]>;
  /**
   * How many rows each of a field's values would show, by value: a grouped
   * count on that field or path, of the query given. Fills the options'
   * counts of a field with `counts: true` in its config; an option it
   * leaves out shows 0.
   */
  countsBy?: (field: FieldPath, value: FilterQuery) => Promise<Record<string, number>>;
  /** How many rows a query shows: each preset's count, of a presets field with `counts: true`. */
  countFor?: (value: FilterQuery) => Promise<number>;
  /**
   * The conditions the page sets ("Project is TIX"), in every value
   * `onChange` hands out. Drawn first, as a read-only `rules` field of grey
   * chips with a lock, which neither the reader nor Clear can take away; a
   * value holding them shows them there and in no other field.
   */
  locked?: Filter;
  /**
   * How many rows the filter lets through, of how many in all, or 'loading'
   * while they are counted: the `count` slot draws it with the registry's
   * `filter.count` and the resource's name for its rows.
   */
  count?: { shown: number; total: number } | 'loading';
}

/** The field that draws the page's locked conditions, a name no app's field takes. */
const LOCKED = '@locked';

/**
 * The form with the page's locked conditions drawn first, as a read-only
 * `rules` field: inside its first layout, the bar, when it starts with one.
 * Drawn only by a registry with a `rules` input; they apply all the same.
 */
function withLocked<I extends InputRegistry, L extends LayoutComponentRegistry>(
  form: FormConfig<I, L>,
  locked: readonly Filter[],
  inputs: AnyInputs,
): FormConfig<I, L> {
  if (locked.length === 0 || !inputs.has('rules')) {
    return form;
  }
  const field = {
    kind: 'field',
    name: LOCKED,
    type: 'rules',
    label: 'Set by the page',
    readOnly: true,
    config: {},
    filter: { rules: true },
  };
  const nodes = form.nodes as unknown as AnyNodes;
  const [first, ...others] = nodes;
  const drawn =
    first && first.kind !== 'field' && 'children' in first
      ? [{ ...first, children: [field, ...first.children] }, ...others]
      : [field, ...nodes];
  return { ...form, nodes: drawn as unknown as FormConfig<I, L>['nodes'] };
}

/** Each field's counts, by its name, then by option value. */
type Counts = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** How long after the value changes its counts are asked for again, in milliseconds. */
const COUNT_PAUSE = 300;

/** What a filter form reads of TanStack's form, which the runtime carries as `unknown`. */
interface HeldForm {
  state: { values: Record<string, unknown> };
  store: unknown;
  setFieldValue: (
    name: string,
    value: unknown,
    options?: { dontUpdateMeta?: boolean; dontValidate?: boolean },
  ) => void;
}

/** Whether a form's tree holds a submit: then it applies with that button. */
function hasSubmit(nodes: AnyNodes): boolean {
  return nodes.some((node) => {
    if (node.kind === 'action') {
      return (node as { action: string }).action === 'submit';
    }
    return 'children' in node && hasSubmit(node.children);
  });
}

/** Whether every reset in the form is a Clear: `to: 'start'`, or any reset in a form without a submit. */
function resetsClear(nodes: AnyNodes, submits: boolean): boolean {
  return nodes.every((node) => {
    if (node.kind === 'action') {
      const action = node as unknown as ActionNode;
      return action.action !== 'reset' || !submits || action.to === 'start';
    }
    return !('children' in node) || resetsClear(node.children, submits);
  });
}

/**
 * Whether Clear has more to let go of than the fields hold: the other
 * part's conditions, or what no field shows. A Clear waits for a change to
 * the fields; with more, it doesn't.
 */
const ClearsMore = createContext(false);

/**
 * The registry's button, or a plain one as a form draws without it: a
 * Clear with more to let go of than the fields hold doesn't wait.
 */
function useClearingRegistry<I extends InputRegistry, L extends LayoutComponentRegistry>(
  registry: FormRegistry<I, L>,
): FormRegistry<I, L> {
  const Button = registry.action?.Component;
  return useMemo(() => {
    function FilterAction(props: ActionProps) {
      const more = useContext(ClearsMore);
      const reset = props.action === 'reset';
      const disabled = props.disabled && !(more && reset && !props.loading);
      if (Button) {
        return <Button {...props} disabled={disabled} />;
      }
      return (
        <button type={reset ? 'button' : 'submit'} disabled={disabled} onClick={props.onClick}>
          {props.label}
        </button>
      );
    }
    return { ...registry, action: { Component: FilterAction } };
  }, [registry, Button]);
}

/** Whether the form has a field named `search`, which the query's `search` fills. */
function hasSearch(nodes: AnyNodes): boolean {
  return nodes.some((node) => {
    if (node.kind === 'field') {
      return (node as { name: string }).name === 'search';
    }
    return 'children' in node && hasSearch(node.children);
  });
}

/** The visible fields' values: what a form hands `onCommit` and `onSubmit`. */
function visibleOf(nodes: AnyNodes, values: Record<string, unknown>): Record<string, unknown> {
  const visible = collectVisibleFields(nodes as never, values);
  return Object.fromEntries(Object.entries(values).filter(([name]) => visible.has(name)));
}

/** What one part of a filter form is told besides the form's own props: the whole form is one part. */
interface Part {
  /** Whether it draws the locked conditions: the bar does, the sheet doesn't. */
  drawsLocked: boolean;
  /**
   * The conditions the other part's fields hold: shown in neither this
   * part's fields nor its `rules`, and handed back unchanged, unless a change
   * here drops one of them.
   */
  hidden: readonly Filter[];
  /** Whether Clear empties this part's fields only, as the sheet's does: what the others hold stays. */
  scoped: boolean;
  /** Whether its submit's `{count}` is filled from `countFor`, of the value it would apply. */
  countsLabel: boolean;
  /** Called once a submit has applied: the sheet closes. */
  onApplied?: () => void;
  /** Slots it fills itself: the bar's sheet. */
  slots?: Readonly<Record<string, ReactNode>>;
}

/** The whole form, drawn as one. */
const WHOLE: Part = { drawsLocked: true, hidden: [], scoped: false, countsLabel: false };

/** No condition. */
const NONE: readonly Filter[] = [];

/** The options folding and spreading take: the operators, and each field's empty value. */
function useFilterOptions(inputs: AnyInputs, operators: OperatorRegistry): FilterOptions {
  return useMemo<FilterOptions>(() => {
    return {
      operators,
      emptyOf: (field) => {
        return inputs.has(field.type) ? inputs.get(field.type).defaultValue : undefined;
      },
    };
  }, [inputs, operators]);
}

/** The page's locked conditions, by what they hold. */
function useLocked(locked: Filter | undefined): readonly Filter[] {
  const key = JSON.stringify(locked ?? null);
  return useMemo(() => {
    const filter = JSON.parse(key) as Filter | null;
    return filter === null ? NONE : entriesOf(filter);
  }, [key]);
}

/** A form's own width, measured as it changes: undefined until it is, or while `enabled` is false. */
function useWidth(ref: RefObject<HTMLElement | null>, enabled: boolean): number | undefined {
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) {
      return undefined;
    }
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return width;
}

/**
 * A form's fields as the filters above a list. Its value is the query's own
 * `{ search, filter }`: each field with a `filter` holds a part of it
 * (`FieldFilter`), and the field named `search` holds the search. It draws
 * `<Form>` with the nearest `FormProvider`'s registry.
 *
 * - The form starts with no field holding a condition, and shows `value`
 *   apart from that, so its reset with `to: 'start'` is Clear: it empties
 *   the form, after an Apply too.
 * - Without a submit in the tree, each change applies at once: `onChange`
 *   runs from each commit. With one, it runs on submit, and until then the
 *   `changes` slot says how many fields hold a change not applied.
 * - A condition that one field drops is dropped by every field holding it
 *   (`dropShared`). A hidden field writes nothing.
 * - What none of the fields can show (an `any` group, with no `rules` field
 *   to hold it) is handed back unchanged, until Clear.
 * - Narrower than a layout's `narrow.below`, it keeps the fields
 *   `narrow.keep` names in the bar, applying at once, and moves the rest to
 *   the registry's `filter.sheet`, which applies them on its submit.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function FilterForm<I extends InputRegistry, L extends LayoutComponentRegistry = {}>(
  props: FilterFormProps<I, L>,
): ReactNode {
  const spec = useMemo(() => narrowSpec(props.form.nodes as unknown as AnyNodes), [props.form]);
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref, spec !== undefined);
  if (spec === undefined) {
    return <FilterBody<I, L> {...props} part={WHOLE} />;
  }
  const narrow = width !== undefined && width < spec.below;
  return (
    // Measured, so the form knows when it is narrower than its layout says.
    <div ref={ref}>
      {narrow ? (
        <NarrowForm<I, L> {...props} keep={spec.keep} />
      ) : (
        <FilterBody<I, L> {...props} part={WHOLE} />
      )}
    </div>
  );
}

/** Stops a submit or a reset at the sheet: React carries a portal's events up to the bar's form. */
function stop(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * A filter form in a narrow window: the bar of the kept fields, applying at
 * once, with the registry's sheet in its `sheet` slot, holding a form of the
 * other fields that applies on its submit and then closes. The sheet's
 * button's badge counts the conditions its fields hold.
 */
function NarrowForm<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: FilterFormProps<I, L> & { keep: readonly string[] },
): ReactNode {
  const registry = useRegistryOf<I, L>(undefined, '<FilterForm>');
  const { form } = props;
  const keepKey = props.keep.join('\u0000');
  const split = useMemo(() => narrowOf(form, keepKey.split('\u0000')), [form, keepKey]);
  // The sheet's buttons in the registry's row of actions, which a sheet keeps at its foot.
  const sheetForm = useMemo(() => {
    const nodes = split.sheet.nodes as unknown as AnyNodes;
    const fields = nodes.filter((node) => node.kind !== 'action');
    const actions = nodes.filter((node) => node.kind === 'action');
    const row = registry.layouts.has('actions')
      ? [{ kind: 'actions', props: {}, children: actions }]
      : actions;
    return { ...split.sheet, nodes: [...fields, ...row] };
  }, [split, registry]);

  // What each part's fields hold of the value, so neither shows the other's.
  const options = useFilterOptions(registry.inputs, props.operators);
  const locked = useLocked(props.locked);
  const key = JSON.stringify(lessHeld(props.value, locked));
  const held = useMemo(() => {
    const { values } = spreadFilter(
      form.nodes as unknown as AnyNodes,
      JSON.parse(key) as FilterValue,
      options,
    );
    const writes = (nodes: AnyNodes) => entriesOf(foldFilter(nodes, values, options).filter);
    return {
      bar: writes(split.bar.nodes as unknown as AnyNodes),
      sheet: writes(split.sheet.nodes as unknown as AnyNodes),
    };
  }, [form, split, key, options]);

  const [open, setOpen] = useState(false);
  const Sheet = registry.filter?.sheet;
  const sheet = Sheet ? (
    <Sheet title="Filters" count={held.sheet.length} open={open} onOpenChange={setOpen}>
      <div onSubmit={stop} onReset={stop}>
        <FilterBody<I, L>
          {...props}
          form={sheetForm}
          part={{
            drawsLocked: false,
            hidden: held.bar,
            scoped: true,
            countsLabel: true,
            onApplied: () => setOpen(false),
          }}
        />
      </div>
    </Sheet>
  ) : null;
  return (
    <FilterBody<I, L>
      {...props}
      form={split.bar}
      part={{
        drawsLocked: true,
        hidden: held.sheet,
        scoped: false,
        countsLabel: false,
        slots: { [SHEET_SLOT]: sheet },
      }}
    />
  );
}

/**
 * The spread's values, with a field of one preset keeping the preset it
 * holds while the value has its conditions and the spread's choice has no
 * more of them: picking "By person", which sets nothing until a person is
 * picked, isn't undone by the "All" the same value spreads to.
 */
function steady(
  nodes: AnyNodes,
  values: Record<string, unknown>,
  value: FilterValue,
  current: Record<string, unknown> | undefined,
  options: FilterOptions,
): Record<string, unknown> {
  if (!current) {
    return values;
  }
  const entries = entriesOf(value.filter ?? { all: [] });
  const holds = (filter: Filter) => {
    return entriesOf(filter).every((entry) => entries.some((each) => sameFilter(each, entry)));
  };
  let out = values;
  for (const field of filterFields(nodes)) {
    const own = field.filter;
    const now = current[field.name];
    if (!('presets' in own) || typeof now !== 'string' || now === values[field.name]) {
      continue;
    }
    if (options.emptyOf && Array.isArray(options.emptyOf(field))) {
      continue;
    }
    const kept = own.presets.find((preset) => preset.value === now);
    const chosen = own.presets.find((preset) => preset.value === values[field.name]);
    const size = (filter: Filter | undefined) => (filter ? entriesOf(filter).length : 0);
    if (kept && holds(kept.filter) && size(kept.filter) >= size(chosen?.filter)) {
      out = out === values ? { ...values } : out;
      out[field.name] = now;
    }
  }
  return out;
}

/** A value less the conditions shown elsewhere: the page's, and the other part's. */
function lessHeld(value: FilterValue, held: readonly Filter[]): FilterValue {
  if (held.length === 0 || value.filter === undefined) {
    return value;
  }
  const all = entriesOf(value.filter).filter((entry) => {
    return !held.some((each) => sameFilter(each, entry));
  });
  return { ...value, filter: { all } };
}

/** The conditions one field writes for a value of it. */
function writesOf(field: FilterField, value: unknown, options: FilterOptions): Filter[] {
  return entriesOf(foldFilter([field], { [field.name]: value }, options).filter);
}

/** A form's submits with `{count}` in their labels filled: with the count, or left out while there is none. */
function withCount<I extends InputRegistry, L extends LayoutComponentRegistry>(
  form: FormConfig<I, L>,
  count: number | undefined,
): FormConfig<I, L> {
  const fill = (nodes: AnyNodes): AnyNodes => {
    return nodes.map((node) => {
      if (node.kind === 'action') {
        const action = node as ActionNode;
        if (action.action !== 'submit' || !action.label.includes('{count}')) {
          return node;
        }
        const label =
          count === undefined
            ? action.label.replace(/\s*\{count\}/, '')
            : action.label.replace('{count}', String(count));
        return { ...action, label };
      }
      return 'children' in node && node.kind !== 'field'
        ? { ...node, children: [...fill(node.children)] }
        : node;
    });
  };
  return {
    ...form,
    nodes: fill(form.nodes as unknown as AnyNodes) as unknown as FormConfig<I, L>['nodes'],
  };
}

/** One part of a filter form, or the whole of it: a `<Form>` over the value. */
function FilterBody<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: FilterFormProps<I, L> & { part: Part },
): ReactNode {
  const { form, onChange, part } = props;
  const registry = useRegistryOf<I, L>(undefined, '<FilterForm>');
  const nodes = form.nodes as unknown as AnyNodes;
  const { meta, operators, kinds } = props;
  const options = useFilterOptions(registry.inputs, operators);
  const submits = useMemo(() => hasSubmit(nodes), [nodes]);

  const locked = useLocked(props.locked);
  // The conditions shown by no field here: the page's, and the other part's.
  const hiddenKey = JSON.stringify(part.hidden);
  const held = useMemo(() => {
    return [...locked, ...(JSON.parse(hiddenKey) as Filter[])];
  }, [locked, hiddenKey]);
  // The locked field's value: the locked conditions, which a reset keeps.
  const drawn = part.drawsLocked ? locked : NONE;
  const lockedValue = useMemo((): Record<string, unknown> => {
    return drawn.length === 0 ? {} : { [LOCKED]: drawn };
  }, [drawn]);

  // Where the form starts, and where Clear puts it: no field holding a
  // condition, as the empty filter spreads ("All" on a segmented of presets).
  const start = useMemo(() => {
    return { ...spreadFilter(nodes, {}, options).values, ...lockedValue };
  }, [nodes, options, lockedValue]);
  // The value by what it holds, less what no field here shows: the same
  // filter handed back after a change is no new value.
  const key = JSON.stringify(lessHeld(props.value, held));
  const spread = useMemo(() => {
    const out = spreadFilter(nodes, JSON.parse(key) as FilterValue, options);
    return { ...out, values: { ...out.values, ...lockedValue } };
  }, [nodes, options, key, lockedValue]);

  // What no field holds, folded back unchanged until Clear lets it go.
  const rest = useRef<Filter[]>(spread.rest);
  // The other part's conditions a change here dropped, which aren't handed back.
  const dropped = useRef<Filter[]>([]);
  // What the callbacks read when they run, after the render that made them.
  const latest = useRef({ nodes, options, spread, onChange, submits, props, locked, part });
  latest.current = { nodes, options, spread, onChange, submits, props, locked, part };

  // Each field's counts, asked for at once, then again a pause after each new value.
  const counts = useCounts(nodes, key, held, options, latest);

  // The fields' values as the query's: the locked conditions first, the
  // other part's, then the fields', then what no field holds.
  const fold = (values: Record<string, unknown>): FilterQuery => {
    const now = latest.current;
    const out = foldFilter(now.nodes, values, now.options);
    const others = now.part.hidden.filter((entry) => {
      return !dropped.current.some((each) => sameFilter(each, entry));
    });
    const all: Filter[] = [];
    for (const entry of [...now.locked, ...others, ...entriesOf(out.filter), ...rest.current]) {
      addOnce(all, entry);
    }
    return { ...out, filter: { all } };
  };

  const tanstackRef = useRef<HeldForm | null>(null);
  const api = useStandaloneForm<I, L>({
    form,
    registry,
    defaultValues: start,
    values: steady(
      nodes,
      spread.values,
      JSON.parse(key) as FilterValue,
      tanstackRef.current?.state.values,
      options,
    ),
    onCommit: (change: CommitChange, values: Record<string, unknown>) => {
      const now = latest.current;
      // What the field let go of is let go everywhere: by the other fields
      // here, and from the other part's conditions.
      const field = filterFields(now.nodes).find((each) => each.name === change.field);
      if (field) {
        const after = writesOf(field, change.value, now.options);
        for (const entry of writesOf(field, change.previous, now.options)) {
          if (!after.some((each) => sameFilter(each, entry))) {
            addOnce(dropped.current, entry);
          }
        }
        dropped.current = dropped.current.filter((entry) => {
          return !after.some((each) => sameFilter(each, entry));
        });
      }
      const next = dropShared(now.nodes, values, change, now.options);
      for (const [name, value] of Object.entries(next)) {
        if (value !== values[name]) {
          tanstackRef.current?.setFieldValue(name, value, {
            dontUpdateMeta: true,
            dontValidate: true,
          });
        }
      }
      if (!now.submits) {
        now.onChange(fold(next));
      }
    },
    ...(submits
      ? {
          onSubmit: (values: Record<string, unknown>) => {
            onChange(fold(values));
            latest.current.part.onApplied?.();
          },
        }
      : {}),
  });
  const tanstack = api.__internals.form as HeldForm;
  tanstackRef.current = tanstack;
  const commits = api.__internals.commits;

  useLayoutEffect(() => {
    rest.current = spread.rest;
    dropped.current = [];
    // With a button, what's applied is what a change waits against: dirty is
    // measured from the value, and a reset with no `to` goes back to it.
    if (submits) {
      commits.submitted({ ...tanstack.state.values, ...spread.values });
    }
  }, [spread, submits, commits, tanstack]);

  // How many fields hold a change not applied yet: the shown fields that
  // hold a part of the filter, or the search, and differ from the value.
  const names = useMemo(() => {
    const own = filterFields(nodes).map((field) => field.name);
    return hasSearch(nodes) ? [...own, 'search'] : own;
  }, [nodes]);
  const applied = useSyncExternalStore(commits.subscribe, commits.baseline);
  const waiting = useSelector(
    formStore<{ values: Record<string, unknown> }>(tanstack.store),
    (state: { values: Record<string, unknown> }) => {
      if (!submits) {
        return 0;
      }
      const visible = collectVisibleFields(nodes as never, state.values);
      const against = applied ?? start;
      return names.filter((name) => {
        return visible.has(name) && !sameValues(state.values[name], against[name]);
      }).length;
    },
  );

  // The value a submit would apply, by what it holds: its `{count}` is asked for.
  const pending = useSelector(
    formStore<{ values: Record<string, unknown> }>(tanstack.store),
    (state: { values: Record<string, unknown> }) => {
      return part.countsLabel ? JSON.stringify(fold(visibleOf(nodes, state.values))) : '';
    },
  );
  const shown = useCountFor(pending, latest);

  // The fields as the metadata fills them: labels, options and their counts.
  const asksOptions = props.optionsFor !== undefined;
  const filled = useMemo(() => {
    const optionsFor = asksOptions
      ? (resource: string, text: string) => {
          return (latest.current.props.optionsFor as NonNullable<typeof props.optionsFor>)(
            resource,
            text,
          );
        }
      : undefined;
    const config = fillFilterForm(
      withLocked(form, drawn, registry.inputs),
      { meta, operators, kinds, ...(optionsFor ? { optionsFor } : {}) },
      { counts, values: spread.values },
    );
    return part.countsLabel ? withCount(config, shown) : config;
  }, [
    form,
    meta,
    operators,
    kinds,
    asksOptions,
    counts,
    spread,
    drawn,
    registry,
    part.countsLabel,
    shown,
  ]);

  // A reset puts the fields back, then applies at once in a form without a
  // button. Clear (`to: 'start'`) lets go of what no field holds too, and of
  // the other part's conditions, unless it is the sheet's.
  const formApi: FormApi = {
    ...api,
    __internals: { ...api.__internals, config: filled as never },
    reset: (resetOptions?: ResetOptions) => {
      api.reset(resetOptions);
      const now = latest.current;
      const clears = (resetOptions?.to === 'start' || !now.submits) && !now.part.scoped;
      rest.current = clears ? [] : now.spread.rest;
      dropped.current = clears ? [...now.part.hidden] : [];
      if (!now.submits) {
        now.onChange(fold(visibleOf(now.nodes, tanstack.state.values)));
      }
    },
  };

  const Changes = registry.filter?.changes;
  const Count = registry.filter?.count;
  const { count } = props;
  const slots = {
    ...props.slots,
    ...part.slots,
    ...(Count && count !== undefined
      ? {
          count:
            count === 'loading' ? (
              <Count label={meta.label} loading />
            ) : (
              <Count label={meta.label} shown={count.shown} total={count.total} loading={false} />
            ),
        }
      : {}),
    ...(submits && Changes ? { changes: <Changes count={waiting} /> } : {}),
  };
  // Clear lets go of the other part's conditions and of what no field
  // shows, so it doesn't wait for a change while there are some.
  const clearsMore =
    !part.scoped &&
    (part.hidden.length > 0 || spread.rest.length > 0) &&
    resetsClear(nodes, submits);
  const drawing = useClearingRegistry(registry);
  return (
    <ClearsMore value={clearsMore}>
      <Form<I, L> registry={drawing} formApi={formApi} slots={slots} />
    </ClearsMore>
  );
}

/**
 * How many rows the value a submit would apply shows, from `countFor`:
 * asked a pause after it changes, an answer to an older value dropped.
 * Undefined until the first answer, and without `countFor`.
 */
function useCountFor(
  pending: string,
  latest: { current: { props: Pick<FilterFormProps<InputRegistry>, 'countFor'> } },
): number | undefined {
  const [count, setCount] = useState<number>();
  useEffect(() => {
    const countFor = latest.current.props.countFor;
    if (pending === '' || !countFor) {
      return undefined;
    }
    let stale = false;
    const timer = setTimeout(() => {
      countFor(JSON.parse(pending) as FilterQuery).then(
        (next) => {
          if (!stale) {
            setCount(next);
          }
        },
        () => {
          // The label keeps the count it has.
        },
      );
    }, COUNT_PAUSE);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [pending, latest]);
  return count;
}

/**
 * The counts of the fields with `counts: true`: asked for at once, then again
 * a pause after each new value, so typing a search asks once it stops. An
 * answer that comes after a newer value's question is dropped, and a count
 * that fails leaves the field's counts as they were.
 */
function useCounts(
  nodes: AnyNodes,
  key: string,
  held: readonly Filter[],
  options: FilterOptions,
  latest: {
    current: {
      props: Pick<FilterFormProps<InputRegistry>, 'countsBy' | 'countFor'>;
    };
  },
): Counts {
  const [counts, setCounts] = useState<Counts>({});
  const asked = useRef(false);
  useEffect(() => {
    const asks = countAsks(nodes, JSON.parse(key) as FilterValue, options, held);
    if (asks.length === 0) {
      return;
    }
    let stale = false;
    const ask = async () => {
      const { countsBy, countFor } = latest.current.props;
      const answers = await Promise.allSettled(
        asks.map(async (each) => {
          if ('path' in each) {
            return countsBy ? ([each.name, await countsBy(each.path, each.query)] as const) : null;
          }
          if (!countFor) {
            return null;
          }
          const presets = await Promise.all(
            each.presets.map(async (preset) => [preset.value, await countFor(preset.query)]),
          );
          return [each.name, Object.fromEntries(presets) as Record<string, number>] as const;
        }),
      );
      if (stale) {
        return;
      }
      setCounts((now) => {
        const next: Record<string, Readonly<Record<string, number>>> = { ...now };
        for (const answer of answers) {
          if (answer.status === 'fulfilled' && answer.value) {
            next[answer.value[0]] = answer.value[1];
          }
        }
        return next;
      });
    };
    const timer = setTimeout(() => void ask(), asked.current ? COUNT_PAUSE : 0);
    asked.current = true;
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [nodes, key, held, options, latest]);
  return counts;
}
