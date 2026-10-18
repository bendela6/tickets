// A template: what a record shows, as JSON, the display half of what bh's
// forms are for input. A table column's cell, a list item, a tile and a card's
// body are all templates: parts laid out in registered layouts, nested as deep
// as one needs, each part drawn by a registered renderer with a registered
// format. It imports no React and no DOM, so a server stores a template as a
// browser draws it. bh's layouts and renderers, and what draws a template, are
// @bh/ui's.
export type { AnyLayouts, Layouts, LayoutNode, TemplateNode } from './template';
export {
  partDefaults,
  resolvePart,
  type FieldPart,
  type Part,
  type PartDefaults,
  type PartOptions,
  type PartRenderer,
  type TemplateField,
  type TextPart,
  type ValuePart,
} from './part';
export { fillText, textPaths } from './text';
export { fieldAt, partValues, shownOf, textOf, type RefTarget, type ShowContext } from './shown';
export { entryOf, functionSchema, named, optionsSchema } from './registry';
export {
  canShow,
  fits,
  rendererData,
  type RendererEntry,
  type RendererProps,
  type RendererSpec,
  type Shown,
} from './renderer-registry';
export { defineHost, type Host, type HostSpec } from './host';
export {
  entriesOf,
  layoutData,
  type LayoutEntry,
  type LayoutProps,
  type LayoutSpec,
} from './layout-registry';
export { isAddress, isRoute, linkTarget } from './link';
export { checkFormats, formatValue } from './format/formats';
export { baseFormats, type BaseFormats } from './format/base-formats';
export {
  defineFormat,
  type FormatContext,
  type FormatRegistry,
  type Formatter,
  type FormatValue,
} from './format/registry';
export { bytesFormat, type BytesOptions } from './base/formats/bytes';
export { dateFormat } from './base/formats/date';
export { datetimeFormat, type DatetimeOptions } from './base/formats/datetime';
export { durationFormat, type DurationOptions } from './base/formats/duration';
export { markdownFormat } from './base/formats/markdown';
export { moneyFormat, type MoneyOptions } from './base/formats/money';
export { numberFormat, type NumberOptions } from './base/formats/number';
export { percentFormat, type PercentOptions } from './base/formats/percent';
export { plainFormat } from './base/formats/plain';
export { relativeFormat, type RelativeOptions } from './base/formats/relative';
export { richFormat } from './base/formats/rich';
export { formatText, type FormatPiece } from './format/pieces';
// The pure functions the formats write with, which @bh/ui also exports by the
// same names.
export { formatBytes, type FormatBytesOptions } from './format/bytes';
export { formatDuration, type FormatDurationOptions } from './format/duration';
export { formatDateTime, type FormatDateTimeOptions } from './format/date-time';
export { formatExact, relativeLabel, type RelativeLabelOptions } from './format/dates';
export type { DateLocaleOptions } from './format/date-locale';
