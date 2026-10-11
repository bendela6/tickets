import type { RenderScrimCtx } from '@bh/table';
import { cn } from '../../../style';

/**
 * The 16px fade where columns pass out of sight.
 *
 * Two places, one treatment: beside the frozen columns, and at whichever side
 * of the frame is hiding something. It is the same statement in both — content
 * continues under this line — which is why the freeze line and the frame's
 * hidden edge already share a colour (`gray-8`). The fade is the softer half
 * of that: a rule says where the boundary is, a gradient says which side the
 * content went.
 *
 * The gradient itself is a hand-authored class (`table-scrim`, in the
 * library's stylesheet) rather than utilities, because it has to change
 * COLOUR between themes and not merely shade: light fades from `gray-6`, dark
 * from `surface-inset`. In light the hidden content darkens as it goes under;
 * in dark it goes black. Fading from the same token in both would make the
 * dark one a glow.
 *
 * It stops above the dock — the scrollbar and status bar are the table's
 * chrome, not its content, and a fade running over them would look like a
 * smudge on the frame.
 *
 * The FREEZE scrim rides a rung of its own, and it is the difference between
 * the two things this slot draws. The frame's edges belong to the frame: they
 * mark where the table is clipped, and the chrome standing on it — the sticky
 * header at `z-10`, the totals row beside it — sits over them, which is also
 * the only thing keeping the `end` fade from washing over a right-pinned band
 * parked on that very edge. The freeze scrim belongs to the BAND, and the
 * band's whole claim is that everything passes under it, header labels
 * included. At `z-6` it was cut off flat by the header's 40px and the fade
 * started below the first row — the boundary read as two different edges
 * stacked, which is the fault this fixes. `z-11` is one rung over the header
 * and still under the dock's `z-20`, and the scrim starts at the band's outer
 * edge, so rising cannot put it over the frozen columns themselves.
 *
 * Which is also why it starts one pixel FURTHER out than the engine's offset.
 * The band's own edge (`PINNED_EDGE`) casts a 1px rule onto exactly that
 * pixel, and this gradient begins at full strength — over the rule it would
 * simply paint it out, so the boundary would lose its line at the moment the
 * table started sliding and get it back when it stopped. One pixel is the
 * render set's to add: the engine says where the band ends, the treatment
 * says what stands there.
 */
export function renderScrim({ kind, offset, bottom }: RenderScrimCtx) {
  const fromRight = kind === 'end';
  const freeze = kind === 'freeze';
  return (
    <span
      aria-hidden
      data-slot="table-scrim"
      data-kind={kind}
      className={cn(
        'table-scrim pointer-events-none absolute top-0 w-16',
        freeze ? 'z-11' : 'z-6',
        fromRight && 'table-scrim-end',
      )}
      style={{
        bottom,
        ...(fromRight ? { right: offset } : { left: freeze ? offset + 1 : offset }),
      }}
    />
  );
}
