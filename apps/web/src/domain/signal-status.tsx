import type { ReactElement } from 'react';
import { Icon, type IconName } from '@tickets/ui/icon';
import type { Tone } from '@tickets/ui/tones';

// The app's ONE signals issue-status mapping — ported from the retired
// signals status-chip component's STATUS table. Shape-coded per
// docs/design/SigGallery.dc.html "ISSUE STATUS — INHERITS THE STATUS-KIND
// SHAPES": open is a half-filled accent circle, resolved a filled ok circle
// with a check, ignored a dashed muted circle.
export type SignalStatus = 'open' | 'resolved' | 'ignored';

type Entry = { tone: Tone; icon: ReactElement; label: string };

const MAP: Record<SignalStatus, Entry> = {
  open: { tone: 'blue', icon: <Icon name="circle-half" size={10} />, label: 'open' },
  resolved: { tone: 'green', icon: <Icon name="circle-check" size={10} />, label: 'resolved' },
  ignored: { tone: 'gray', icon: <Icon name="circle-dashed" size={10} />, label: 'ignored' },
};

export function signalStatus(status: SignalStatus): Entry {
  return MAP[status];
}

// The adjacent "↺ regressed" chip shown next to the status pill — a
// resolved/ignored issue that received a fresh occurrence after being
// closed. Not carried by `signalStatus` itself since it's a second,
// independent pill rendered beside the status one, not a status value.
export const regressedPill = { tone: 'orange' as const, label: '↺ regressed' };

// The app's ONE signal-kind glyph mapping — ported from the retired
// components/signals/kind-glyph.tsx KindGlyph, whose hand-drawn unicode
// glyphs (◆ ≡ ◉ → ⇅ ✕ ✳) now map onto the shared Icon registry's closest
// shapes instead: event's filled diamond stays a diamond, log's stacked
// lines becomes `rows`, click's ringed dot becomes `circle-dot`, navigation's
// arrow becomes `arrow-up-right`, http (data over the wire) becomes `link`,
// error's × becomes `triangle-alert` (matching KIND_ICON's danger glyph
// elsewhere), and custom's asterisk becomes `tag`.
export type SignalKind = 'event' | 'log' | 'click' | 'navigation' | 'http' | 'error' | 'custom';

const SIGNAL_KIND_ICON: Record<SignalKind, IconName> = {
  event: 'diamond',
  log: 'rows',
  click: 'circle-dot',
  navigation: 'arrow-up-right',
  http: 'link',
  error: 'triangle-alert',
  custom: 'tag',
};

export function signalKindIcon(kind: SignalKind): IconName {
  return SIGNAL_KIND_ICON[kind];
}

// Badge tone per kind — mirrors the retired KindGlyph's KIND map coloring
// (event got the accent treatment, error danger, everything else neutral).
const SIGNAL_KIND_TONE: Record<SignalKind, Tone> = {
  event: 'primary',
  log: 'secondary',
  click: 'secondary',
  navigation: 'secondary',
  http: 'secondary',
  error: 'danger',
  custom: 'secondary',
};

export function signalKindTone(kind: SignalKind): Tone {
  return SIGNAL_KIND_TONE[kind];
}
