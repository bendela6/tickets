import type { ReactElement } from 'react';
import { Icon } from '@tickets/ui/icon';
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
