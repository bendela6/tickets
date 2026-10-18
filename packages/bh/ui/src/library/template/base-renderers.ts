import type { BaseKind } from '@bh/resource';
import { avatarRenderer, type AvatarOptions } from './renderers/avatar';
import { checkRenderer } from './renderers/check';
import { codeRenderer } from './renderers/code';
import { dateRenderer } from './renderers/date';
import { iconRenderer, type IconOptions } from './renderers/icon';
import { linkRenderer, type LinkOptions } from './renderers/link';
import { meterRenderer, type MeterOptions } from './renderers/meter';
import { numberRenderer } from './renderers/number';
import { pillRenderer, type PillOptions } from './renderers/pill';
import { progressRenderer, type ProgressOptions } from './renderers/progress';
import { textRenderer } from './renderers/text';
import { trendRenderer, type TrendOptions } from './renderers/trend';
import { userRenderer, type UserOptions } from './renderers/user';
import { noRenderers } from './renderer-registry';

/** No options. */
type NoOptions = Record<string, never>;

/** bh's renderers, by name, with their options. */
export interface BaseRenderers {
  text: NoOptions;
  link: LinkOptions;
  pill: PillOptions;
  date: NoOptions;
  number: NoOptions;
  avatar: AvatarOptions;
  user: UserOptions;
  icon: IconOptions;
  progress: ProgressOptions;
  meter: MeterOptions;
  trend: TrendOptions;
  check: NoOptions;
  code: NoOptions;
}

/** bh's thirteen renderers. */
export const baseRenderers = noRenderers.register({
  text: textRenderer,
  link: linkRenderer,
  pill: pillRenderer,
  date: dateRenderer,
  number: numberRenderer,
  avatar: avatarRenderer,
  user: userRenderer,
  icon: iconRenderer,
  progress: progressRenderer,
  meter: meterRenderer,
  trend: trendRenderer,
  check: checkRenderer,
  code: codeRenderer,
});

/** Each kind's default renderer. An app adds its own: `{ ...baseDefaultRenderers, color: 'swatch' }`. */
export const baseDefaultRenderers: Readonly<Record<BaseKind, keyof BaseRenderers>> = Object.freeze({
  text: 'text',
  markdown: 'text',
  richtext: 'text',
  url: 'link',
  email: 'link',
  phone: 'link',
  number: 'number',
  boolean: 'check',
  date: 'date',
  time: 'text',
  datetime: 'date',
  option: 'pill',
  ref: 'user',
  file: 'link',
  json: 'code',
});
