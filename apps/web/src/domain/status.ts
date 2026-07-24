import type { IconName } from '@tickets/ui/icon';
import type { HueTone } from '@tickets/ui/tones';
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

const KIND_TONE: Record<StatusKind, HueTone> = {
  todo: 'gray',
  active: 'blue',
  blocked: 'orange',
  done: 'green',
  dropped: 'gray',
};

export function statusPill(kind: StatusKind): {
  tone: HueTone;
  icon: IconName;
  strikethrough?: true;
} {
  return kind === 'dropped'
    ? { tone: KIND_TONE[kind], icon: KIND_ICON[kind], strikethrough: true }
    : { tone: KIND_TONE[kind], icon: KIND_ICON[kind] };
}
