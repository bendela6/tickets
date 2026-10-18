// What draws a template (@bh/template): Template, and the renderers and
// layouts it names. Each of bh's is one file: its options, its component and
// its entry.
export {
  componentSchema,
  defineRenderer,
  type RendererDefinition,
  type RendererRegistry,
} from './renderer-registry';
export { baseDefaultRenderers, baseRenderers, type BaseRenderers } from './base-renderers';
export {
  defineTemplateLayout,
  type TemplateLayoutDefinition,
  type TemplateLayoutProps,
  type TemplateLayoutRegistry,
} from './layout-registry';
export { baseTemplateLayouts, type BaseLayouts } from './base-layouts';
export { rowLayout, TemplateRowLayout, type RowOptions } from './layouts/row';
export { stackLayout, TemplateStackLayout, type StackOptions } from './layouts/stack';
export { gridLayout, TemplateGridLayout, type GridOptions } from './layouts/grid';
export { repeatLayout, TemplateRepeatLayout, type RepeatOptions } from './layouts/repeat';
export {
  baseTemplateRegistry,
  Template,
  TemplateProvider,
  type TemplateProps,
  type TemplateProviderProps,
  type TemplateRegistry,
} from './template';
export { PartText } from './renderers/look';
export { AvatarRenderer, avatarRenderer, type AvatarOptions } from './renderers/avatar';
export { CheckRenderer, checkRenderer } from './renderers/check';
export { CodeRenderer, codeRenderer } from './renderers/code';
export { DateRenderer, dateRenderer } from './renderers/date';
export { IconRenderer, iconRenderer, type IconOptions } from './renderers/icon';
export {
  createLinkRenderer,
  LinkRenderer,
  linkRenderer,
  type LinkAnchor,
  type LinkOptions,
} from './renderers/link';
export { MeterRenderer, meterRenderer, type MeterOptions } from './renderers/meter';
export { NumberRenderer, numberRenderer } from './renderers/number';
export { PillRenderer, pillRenderer, type PillOptions } from './renderers/pill';
export { ProgressRenderer, progressRenderer, type ProgressOptions } from './renderers/progress';
export { TextRenderer, textRenderer } from './renderers/text';
export { TrendRenderer, trendRenderer, type TrendOptions } from './renderers/trend';
export { UserRenderer, userRenderer, type UserOptions } from './renderers/user';
