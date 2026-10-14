// A template: what a record shows, as JSON, the display half of what bh's
// forms are for input. A table column's cell, a list item, a tile and a card's
// body are all templates: parts laid out in registered layouts, nested as deep
// as one needs, each part drawn by a registered renderer with a registered
// format. It imports no React and no DOM, only @bh/resource's types and
// valibot, so a server checks and stores a template as a browser draws it; the
// components that draw one are @bh/ui's.
export type { Layouts, LayoutNode, TemplateNode } from './template';
export type { BaseLayouts, FlexOptions, Gap, GridOptions, RepeatOptions } from './layouts';
export {
  resolvePart,
  type FieldPart,
  type Part,
  type PartDefaults,
  type PartOptions,
  type PartRenderer,
  type TextPart,
  type ValuePart,
} from './part';
export { fillText, textPaths } from './text';
export { entryOf, named } from './registry';
export {
  baseDefaultRenderers,
  baseRendererSpecs,
  canShow,
  fits,
  partDefaults,
  type AvatarOptions,
  type BaseRenderers,
  type IconOptions,
  type LinkOptions,
  type MeterOptions,
  type PillOptions,
  type ProgressOptions,
  type RendererEntry,
  type RendererProps,
  type RendererSpec,
  type Shown,
  type TrendOptions,
  type UserOptions,
} from './renderers';
export { defineHost, type Host, type HostSpec } from './host';
export {
  baseLayoutSpecs,
  entriesOf,
  type LayoutEntry,
  type LayoutProps,
  type LayoutSpec,
} from './layout-registry';
export { isAddress, isRoute, linkTarget } from './link';
