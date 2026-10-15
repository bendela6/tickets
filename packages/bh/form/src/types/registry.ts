import type { ComponentType, ReactNode } from 'react';
import type { FormAction } from './action-node';
import type { Commit } from './commit';

/** What a form gives the input it draws for a field. */
export interface InputProps<TConfigResolved, TValue> {
  /** The field's name: put it on the focusable element as its `id`, which the field's label names. */
  name: string;
  /**
   * The field's label, from its definition. The wrapper draws it; an input
   * whose element a `<label for>` cannot name (a group, a slider drawn on a
   * div) names itself with it.
   */
  label?: string;
  /** The field's value. Undefined only when neither the field nor its input has a default. */
  value: TValue;
  /** Commits the field's value: it joins the form's values, and `onCommit` runs. Takes the new value alone. */
  onChange: (next: TValue) => void;
  /**
   * When the field commits, as the form says: pass it to a control that holds
   * a draft (`commit` on `Input`). A field's own config may say otherwise.
   * Undefined when the form says nothing: commit at every change.
   */
  commit?: Commit;
  /**
   * Tells the form what's typed before it commits, at every keystroke: a
   * Save while the field is being typed in commits it first, and
   * `useFieldDraft` reads it. A control with no draft needn't call it.
   */
  onDraft?: (draft: TValue) => void;
  /** Whether the field's last commit is still being saved by the form's `onCommit`. */
  saving?: boolean;
  /** Call it when focus leaves the input: the form checks its values then. */
  onBlur: () => void;
  /** The field's config, with every async key resolved; one still loading is left out. */
  config: TConfigResolved;
  /** The field's problem, once the field has been left or a submit tried, or why its last commit failed to save. */
  error?: string;
  /** Whether the form is submitting, when every input takes no changes. */
  disabled?: boolean;
  /**
   * Whether the field is read-only: shown, and still submitted, but the
   * reader can't change it. Pass it to the control's `readOnly`; the form
   * ignores the field's `onChange` meanwhile.
   */
  readOnly?: boolean;
  /** Whether the field's async config is still loading. */
  loading: boolean;
  /** Why the field's async config failed to load, if it did. */
  configError?: Error;
  /**
   * The id of what describes the field now, its problem or else its help: put
   * it on the focusable element as `aria-describedby`.
   */
  describedBy?: string;
}

/** An input kind in a registry: the component that draws it, and the value it starts at. */
export interface InputDefinition<TConfigResolved, TValue> {
  /** The input, given the field's value, config and state. */
  Component: ComponentType<InputProps<TConfigResolved, TValue>>;
  /** What a field of this kind starts at, when neither the field nor the form gives a default. */
  defaultValue?: TValue;
}

/** A registry's inputs, by the kind a field names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputRegistry = Record<string, InputDefinition<any, any>>;

// Helpers used by FieldNode/builder
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InferConfig<D> = D extends InputDefinition<infer C, any> ? C : never;
// From the component alone: a kind's empty `defaultValue` (`null` for a
// select) is one value of its type, and inferring from both found none.
export type InferValue<D> = D extends {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<InputProps<any, infer V>>;
}
  ? V
  : never;

/** What a form gives the layout it draws for a layout node. */
export interface LayoutComponentProps<TProps> {
  /** The node's props, as the form gives them: a card's title, say. */
  props: TProps;
  /** The node's children, already drawn. */
  children: ReactNode;
}

/** A layout kind in a registry: the component that draws it, and the wrapper its fields get. */
export interface LayoutComponentDefinition<TProps> {
  /** The layout, given the node's props and its drawn children. */
  Component: ComponentType<LayoutComponentProps<TProps>>;
  /**
   * The wrapper drawn around each field inside it, at any depth until another
   * layout names its own, in place of the registry's `field`: a filter bar's
   * fields read "Type: any" inside the control, while the same fields in a
   * sheet keep the app's wrapper, label above.
   */
  field?: FieldWrapperDefinition;
}

/** A registry's layouts, by the kind a layout node names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LayoutComponentRegistry = Record<string, LayoutComponentDefinition<any>>;

/** What a form gives the wrapper it draws around each field. */
export interface FieldWrapperProps {
  /** The field's name in the form's values. */
  name: string;
  /**
   * The field's kind, as its input is registered: 'select', 'search'. A
   * wrapper may place the label its own way per kind, as a filter bar's does.
   */
  type?: string;
  /** The field's label, from its definition. */
  label?: string;
  /** Help text for the field, from its definition. */
  description?: string;
  /** Whether the field is required, from its definition. */
  required: boolean;
  /**
   * The field's problem: its validation message, once the field has been
   * left or a submit tried, or why its last commit failed to save.
   */
  error?: string;
  /** The id for the element that holds `description`, which the input is described by. */
  descriptionId?: string;
  /**
   * The id for the element that holds `error`, or `configError`'s message:
   * the input is described by it in the help's place.
   */
  errorId?: string;
  /** Whether the reader has left the field yet. */
  touched: boolean;
  /** Whether the field's config is still resolving, as while its options load. */
  loading: boolean;
  /** Why the field's config failed to resolve, if it did. */
  configError?: Error;
  /** Whether the field's last commit is still being saved by the form's `onCommit`. */
  saving?: boolean;
  /** The field's input, drawn from the registry. */
  children: ReactNode;
}

/** A registry's field wrapper: the component drawn around every field. */
export interface FieldWrapperDefinition {
  /** The wrapper: a label, the input, and its help or its problem. */
  Component: ComponentType<FieldWrapperProps>;
}

/** What a form gives the wrapper it draws around all its fields. */
export interface RootWrapperProps {
  /** The form's fields and layouts, already drawn. */
  children: ReactNode;
}

/** A registry's root wrapper: the component drawn around the whole form. */
export interface RootWrapperDefinition {
  /** The wrapper, given the drawn form. */
  Component: ComponentType<RootWrapperProps>;
}

/** What a form gives the button it draws for a submit or reset node. */
export interface ActionProps {
  /** What it does: submit the form, or put its values back where they started. */
  action: FormAction;
  /** Its text, from the node. */
  label: string;
  /** A reset with nothing to put back, and either while a submit runs. */
  disabled: boolean;
  /** A submit running: the submit button shows it. */
  loading: boolean;
  /** A reset's: puts the values back. A submit is a `type="submit"` button, and needs none. */
  onClick?: () => void;
}

/** A registry's button: the component drawn for every submit and reset node. */
export interface ActionDefinition {
  /** The button, given what it does and the form's state. */
  Component: ComponentType<ActionProps>;
}

/** What a filter form gives the count of the rows its filter lets through. */
export interface FilterCountProps {
  /** How many rows the filter lets through; unknown while it is counted. */
  shown?: number;
  /** How many rows there are in all; unknown when the app doesn't say. */
  total?: number;
  /** The resource's name for one row and for several: `ResourceMeta.label`. */
  label: { one: string; other: string };
  /** The count is being asked for. */
  loading: boolean;
}

/** What a filter form gives the sheet that holds its fields on a phone. */
export interface FilterSheetProps {
  /** The sheet's title: "Filters". */
  title: string;
  /** How many conditions the sheet's fields hold, on its button's badge. */
  count: number;
  /** Whether the sheet is open. */
  open: boolean;
  /** Called with the new open state: from its button, Escape, or its own buttons. */
  onOpenChange: (open: boolean) => void;
  /** The sheet's own form: its fields, then its buttons. */
  children: ReactNode;
}

/** What a filter form gives the words saying it holds changes not applied yet. */
export interface FilterChangesProps {
  /** How many of its fields hold a change its Apply hasn't applied yet; 0 for none. */
  count: number;
}

/** A registry's filter parts: what a filter form draws besides its fields. */
export interface FilterDefinition {
  /** "12 of 40 items", in the count slot. */
  count: ComponentType<FilterCountProps>;
  /** "1 change waiting", in the changes slot of a form that applies with a button. */
  changes: ComponentType<FilterChangesProps>;
  /** The Filters button and the sheet it opens, for a narrow window. */
  sheet: ComponentType<FilterSheetProps>;
}

/** What a form is drawn with: an input per kind, a layout per kind, and the wrappers. */
export interface FormRegistry<I extends InputRegistry, L extends LayoutComponentRegistry> {
  /** The inputs a field may name, by kind. */
  inputs: I;
  /** The layouts a node may name, by kind; `{}` for none. */
  layouts: L;
  /** The wrapper drawn around every field. */
  field: FieldWrapperDefinition;
  /** The wrapper drawn around the whole form; without one, the fields are drawn bare. */
  root?: RootWrapperDefinition;
  /** The button drawn for a submit or reset node; without one, a plain `<button>`. */
  action?: ActionDefinition;
  /** What a filter form draws besides its fields: its count, and its sheet on a phone. */
  filter?: FilterDefinition;
}

/** The props a layout kind takes, read off its definition. */
export type InferLayoutComponentProps<L> = L extends LayoutComponentDefinition<infer P> ? P : never;
