import { cn } from '@tickets/ui';
import { poseAtState } from '../doc/pose';
import { useEditor } from '../editor-context';
import { renderPosed } from '../render/svg';

const THUMB_PX = 98;

/**
 * With motion off, every state resolves to one held pose. Seeing all of them
 * side by side is the actual design constraint the strip exists to enforce: if
 * two states are indistinguishable here, the animation is carrying meaning a
 * reader with motion off will never receive.
 *
 * A sustained state settles on the pose it *enters* the loop at — phase 0,
 * never a mid-loop frame — so the held result is deterministic rather than
 * whatever frame the loop happened to have reached.
 */
export function HeldPoses() {
  const { state, view } = useEditor();
  if (!view.reducedMotion || state.doc.objects.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-col items-center gap-2">
      <span className="font-sans text-9 font-500 tracking-widest text-gray-9">
        HELD POSES — EACH STATE MUST READ BY SHAPE ALONE
      </span>
      <span className="font-mono text-9 text-gray-9">
        a sustained state settles on the pose it enters the loop at — phase 0, never a mid-loop
        frame
      </span>
      <ul className="flex gap-3.5">
        {state.doc.states.map((iconState) => {
          const current = iconState.id === view.to;
          return (
            <li key={iconState.id} className="flex flex-col items-center gap-1.25">
              <div
                aria-hidden
                dangerouslySetInnerHTML={{
                  __html: renderPosed(
                    state.doc,
                    poseAtState(state.doc, iconState.id),
                    { ground: view.ground },
                  ),
                }}
                className={cn(
                  'flex-none overflow-hidden [&>svg]:size-full',
                  current ? 'outline-2 outline-gray-11' : 'outline-1 outline-gray-7',
                )}
                style={{ width: THUMB_PX, height: THUMB_PX }}
              />
              <span
                className={cn('font-mono text-9', current ? 'text-gray-12' : 'text-gray-9')}
              >
                {iconState.name}
                {iconState.sustain ? ' ↻ entry pose' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
