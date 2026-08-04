import type { ComponentProps } from 'react';
import { type Hue, type IconName, type Pill } from '@tickets/ui';
import type { StatusKind } from '../api/types';

// The app's ONE ticket-status mapping. Nothing else in apps/web may decide
// what color/icon a status kind gets — spread this into <Pill>/<Icon>.
export const KIND_ICON: Record<StatusKind, IconName> = {
  todo: 'circle',
  active: 'circle-half',
  blocked: 'diamond',
  done: 'circle-check',
  dropped: 'circle-dashed',
};

// Tone-only view of the mapping, for call sites (e.g. filter chips) that
// render a kind's color without its icon.
export const KIND_TONE: Record<StatusKind, Hue> = {
  todo: 'gray',
  active: 'blue',
  blocked: 'orange',
  done: 'green',
  dropped: 'gray',
};

// Item-type badge preset: outline pill matching the retired TypeBadge look
// (ink-2 text, control-gray border). border-gray-7 overrides the outline
// emphasis's border-gray-11 via cn/twMerge (same border-color group).
export const typePill = {
  tone: 'secondary',
  variant: 'outline',
  className: 'border-gray-7',
} as const satisfies Partial<ComponentProps<typeof Pill>>;

export function statusPill(kind: StatusKind): {
  tone: Hue;
  icon: IconName;
  strikethrough?: true;
} {
  return kind === 'dropped'
    ? { tone: KIND_TONE[kind], icon: KIND_ICON[kind], strikethrough: true }
    : { tone: KIND_TONE[kind], icon: KIND_ICON[kind] };
}
