import type { ComponentType } from 'react';
import {
  baseRendererSpecs,
  type BaseRenderers,
  type RendererEntry,
  type RendererProps,
} from '@bh/template';
import {
  AvatarRenderer,
  CheckRenderer,
  CodeRenderer,
  DateRenderer,
  IconRenderer,
  LinkRenderer,
  MeterRenderer,
  NumberRenderer,
  PillRenderer,
  ProgressRenderer,
  TextRenderer,
  TrendRenderer,
  UserRenderer,
} from './renderers/renderers';

/**
 * A renderer as @bh/ui registers it: its spec from @bh/template (the kinds it
 * shows, its options' schema, the room it needs) and the component that draws
 * a part with it.
 */
export type RendererDefinition<O = Record<string, never>> = RendererEntry<
  ComponentType<RendererProps<O>>,
  O
>;

/** Renderers by the name a part gives: bh's, and an app's own beside them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RendererRegistry = Record<string, RendererDefinition<any>>;

/**
 * bh's renderers, one set for every host: a column's cell, a list item, a
 * tile and a card. An app spreads them and adds its own, as a form's inputs
 * are (`{ ...baseRenderers, swatch: { kinds: ['color'], Component: Swatch } }`),
 * and names its own kind's default beside @bh/template's
 * `baseDefaultRenderers`.
 */
export const baseRenderers = {
  text: { ...baseRendererSpecs.text, Component: TextRenderer },
  link: { ...baseRendererSpecs.link, Component: LinkRenderer },
  pill: { ...baseRendererSpecs.pill, Component: PillRenderer },
  date: { ...baseRendererSpecs.date, Component: DateRenderer },
  number: { ...baseRendererSpecs.number, Component: NumberRenderer },
  avatar: { ...baseRendererSpecs.avatar, Component: AvatarRenderer },
  user: { ...baseRendererSpecs.user, Component: UserRenderer },
  icon: { ...baseRendererSpecs.icon, Component: IconRenderer },
  progress: { ...baseRendererSpecs.progress, Component: ProgressRenderer },
  meter: { ...baseRendererSpecs.meter, Component: MeterRenderer },
  trend: { ...baseRendererSpecs.trend, Component: TrendRenderer },
  check: { ...baseRendererSpecs.check, Component: CheckRenderer },
  code: { ...baseRendererSpecs.code, Component: CodeRenderer },
} satisfies { [K in keyof BaseRenderers]: RendererDefinition<BaseRenderers[K]> };
