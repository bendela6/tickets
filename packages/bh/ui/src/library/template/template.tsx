import { createContext, Fragment, useContext, type ReactNode } from 'react';
import * as v from 'valibot';
import {
  createRegistry,
  matchesFilter,
  type FieldKind,
  type Filter,
  type Id,
  type Registry,
  type Row,
  type Scalar,
} from '@bh/resource';
import {
  baseFormats,
  entriesOf,
  fieldAt,
  fits,
  named,
  partDefaults,
  partValues,
  resolvePart,
  type FormatContext,
  type FormatRegistry,
  type LayoutNode,
  type Part,
  type PartDefaults,
  type RefTarget,
  type ShowContext,
  type TemplateField,
  type TemplateNode,
} from '@bh/template';
import { baseTemplateLayouts } from './base-layouts';
import { baseDefaultRenderers, baseRenderers } from './base-renderers';
import type { TemplateLayoutRegistry } from './layout-registry';
import type { RendererRegistry } from './renderer-registry';
import { PartText } from './renderers/look';

// Template: what every host draws a record's body with, a table column's
// cell, a list item, a tile and a card's, from a template stored as JSON. It
// walks the tree: a node whose `when` doesn't hold shows nothing; a layout
// lays out what its nodes draw, once or once per entry of a list field; a part
// is drawn by its renderer with its values made ready (@bh/template's
// partValues). A part with nothing to show draws its `empty` text, or nothing,
// taking no room. A stored mistake takes nothing down: an unknown layout lays
// its nodes out in a row, an unknown renderer draws text.

/** What a template is drawn with: bh's registries, and an app's own entries beside them. */
export interface TemplateRegistry {
  /** The renderers a part names: bh's (`baseRenderers`), and the app's. */
  renderers: RendererRegistry;
  /** The layouts a layout node names: bh's (`baseTemplateLayouts`), and the app's. */
  layouts: TemplateLayoutRegistry;
  /** The formats a part or a field names: bh's (`baseFormats`), and the app's. */
  formats: FormatRegistry;
  /** The renderer each kind shows with when a part names none: `baseDefaultRenderers`, and the app's kinds'. */
  defaults: Readonly<Record<FieldKind, string>>;
  /** @bh/resource's registry: the kinds, for their default formats, and the operators a `when` uses. */
  resource: Registry;
}

/** bh's own: its renderers, layouts and formats, its kinds' defaults, and its kinds and operators. */
export const baseTemplateRegistry: TemplateRegistry = {
  renderers: baseRenderers,
  layouts: baseTemplateLayouts,
  formats: baseFormats,
  defaults: baseDefaultRenderers,
  resource: createRegistry({ formats: baseFormats }),
};

interface TemplateSettings {
  registry: TemplateRegistry;
  context?: FormatContext;
}

const TemplateContext = createContext<TemplateSettings>({ registry: baseTemplateRegistry });

export interface TemplateProviderProps {
  /** What every template under it is drawn with; bh's own when absent. */
  registry?: TemplateRegistry;
  /** The locale, time zone and now every format under it writes with. */
  context?: FormatContext;
  /** The app, or the part of it whose templates take these. */
  children: ReactNode;
}

/**
 * Supplies the registry and the formats' context once, for every `Template`
 * under it: an app with renderers, layouts or formats of its own wraps its
 * root in one. Without one, a template draws with bh's own.
 */
export function TemplateProvider({
  registry = baseTemplateRegistry,
  context,
  children,
}: TemplateProviderProps) {
  return (
    <TemplateContext.Provider value={context ? { registry, context } : { registry }}>
      {children}
    </TemplateContext.Provider>
  );
}

export interface TemplateProps {
  /** What it draws, as a view stores it: a part, or layouts holding parts. */
  template: TemplateNode;
  /**
   * The record it draws. None while it loads: each part then draws a
   * placeholder in its line, so its host keeps its size.
   */
  record?: Row;
  /** The record's fields, as its resource's metadata has them: each one's kind, settings and format. */
  fields: readonly TemplateField[];
  /** The row a ref field's id points at, by its title and picture; none → the id as text. */
  refOf?: (field: TemplateField, id: Id) => RefTarget | undefined;
  /** The host's width, in pixels: a part whose renderer needs more room is left out. None → every part shows. */
  width?: number;
  /** The signed-in user's id, for a `when` that asks whether a field holds them. */
  viewer?: Scalar;
  /** Its own registry, over the provider's. */
  registry?: TemplateRegistry;
  /** Its own locale, time zone and now, over the provider's. */
  context?: FormatContext;
}

/** What a tree is drawn with, the same at every node. */
interface Scope {
  registry: TemplateRegistry;
  show: ShowContext;
  defaults: PartDefaults;
  width?: number;
  viewer?: Scalar;
  loading: boolean;
}

function isLayout(node: TemplateNode): node is LayoutNode {
  return node.layout !== undefined;
}

/** Whether a `when` holds on the record; one that can't be checked holds, so a stored mistake hides nothing. */
function holds(when: Filter, record: Row, scope: Scope): boolean {
  try {
    return matchesFilter(when, record, scope.show, scope.registry.resource, scope.viewer);
  } catch {
    return true;
  }
}

/** What a part's line holds while the record loads. */
function Placeholder() {
  return (
    <span
      aria-hidden="true"
      className="rounded-4 bg-gray-4 inline-block h-12 w-64 animate-pulse align-middle motion-reduce:animate-none"
    />
  );
}

function drawPart(part: Part, record: Row, scope: Scope): ReactNode {
  const field = part.field === undefined ? undefined : fieldAt(part.field, scope.show.fields);
  const resolved = resolvePart(part, field, scope.defaults);
  const { name, options } = named(resolved.renderer);
  const { renderers } = scope.registry;
  const own = renderers.has(name) ? renderers.get(name) : undefined;
  const parsed = own?.options === undefined ? undefined : v.safeParse(own.options, options);
  // A renderer nothing registered, or options its schema refuses: the text.
  const usable = own !== undefined && (parsed === undefined || parsed.success);
  const entry = usable ? own : (renderers.has('text') ? renderers : baseRenderers).get('text');
  if (scope.width !== undefined && !fits(entry, scope.width)) {
    return null;
  }
  if (scope.loading) {
    return <Placeholder />;
  }
  const look = part.options ?? {};
  const values = partValues(resolved, record, scope.show);
  if (values.length === 0) {
    return look.empty === undefined ? null : (
      <PartText part={{ ...look, tone: undefined, prefix: undefined }} className="text-gray-10">
        {look.empty}
      </PartText>
    );
  }
  const { Component } = entry;
  return (
    <Component
      values={values}
      options={usable && parsed?.success ? parsed.output : {}}
      part={look}
      field={field}
      record={record}
    />
  );
}

/** Each node drawn, those with nothing to show left out. */
function drawAll(nodes: readonly TemplateNode[], record: Row, scope: Scope): ReactNode[] {
  return nodes.flatMap((node, index) => {
    const drawn = drawNode(node, record, scope);
    return drawn === null ? [] : [<Fragment key={index}>{drawn}</Fragment>];
  });
}

function drawLayout(node: LayoutNode, record: Row, scope: Scope): ReactNode {
  const { layouts } = scope.registry;
  const own = layouts.has(node.layout) ? layouts.get(node.layout) : undefined;
  const parsed = own === undefined ? undefined : v.safeParse(own.options, node.options ?? {});
  // An unknown layout, or refused options: a plain row.
  const usable = own !== undefined && parsed?.success === true;
  const entry = usable ? own : (layouts.has('row') ? layouts : baseTemplateLayouts).get('row');
  const options: unknown = usable ? parsed.output : {};
  const repeats = usable && !scope.loading ? own.repeats?.(options) : undefined;
  let items: ReactNode[];
  let more = 0;
  if (repeats) {
    const entries = entriesOf(record, repeats.field, repeats.max);
    items = entries.records.flatMap((each, index) => {
      const drawn = drawAll(node.nodes, each, scope);
      return drawn.length === 0 ? [] : [<Fragment key={index}>{drawn}</Fragment>];
    });
    more = entries.more;
  } else {
    items = drawAll(node.nodes, record, scope);
  }
  if (items.length === 0 && more === 0) {
    return null;
  }
  const { Component } = entry;
  return <Component options={options} items={items} more={more} />;
}

function drawNode(node: TemplateNode, record: Row, scope: Scope): ReactNode {
  if (!scope.loading && node.when !== undefined && !holds(node.when, record, scope)) {
    return null;
  }
  return isLayout(node) ? drawLayout(node, record, scope) : drawPart(node, record, scope);
}

/**
 * Draws a record with a template: what a table column's cell, a list item, a
 * tile and a card's body show, from the same JSON. The registry and the
 * formats' context come from the nearest `TemplateProvider`, else bh's own.
 */
export function Template({
  template,
  record,
  fields,
  refOf,
  width,
  viewer,
  registry: ownRegistry,
  context: ownContext,
}: TemplateProps) {
  const settings = useContext(TemplateContext);
  const registry = ownRegistry ?? settings.registry;
  const format = ownContext ?? settings.context;
  const scope: Scope = {
    registry,
    show: {
      fields,
      formats: registry.formats,
      kinds: registry.resource.kinds,
      ...(format === undefined ? {} : { format }),
      ...(refOf === undefined ? {} : { refOf }),
    },
    defaults: partDefaults(registry.defaults, registry.resource.kinds),
    ...(width === undefined ? {} : { width }),
    ...(viewer === undefined ? {} : { viewer }),
    loading: record === undefined,
  };
  return drawNode(template, record ?? {}, scope);
}
