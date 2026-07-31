import { useEffect, useRef } from 'react';
import { Tabs, cn } from '@tickets/ui';
import { ARTBOARD_PX } from '../doc/constants';
import { useEditor } from '../editor-context';
import { isLooping, readout, sustainOf, tick } from './clock';
import { StateManager } from './state-manager';
import { TimingPopover } from './timing-popover';
import { Track } from './track';

/** The strip matches the artboard's width, never narrower than this. */
const MIN_STRIP_PX = 420;

/**
 * The transport: everything about *time*, in one 34px strip under the
 * artboard, inside the canvas region. It never grows into a rail, because
 * there is no timeline to put in one — states are what you define and
 * transitions are derived.
 *
 * The strip alone stays fully lit during playback, because you need it to stop.
 */
export function Transport() {
  const { state, dispatch, view, setView } = useEditor();
  const { doc } = state;
  const looping = isLooping(doc, view);
  const lines = readout(doc, view);
  const empty = doc.objects.length === 0;

  useFrameClock();

  const play = () => {
    if (view.reducedMotion) return;
    if (view.playing) {
      setView((v) => ({ ...v, playing: false }));
      return;
    }
    setView((v) => {
      const settledAndFinished = v.from === v.to && sustainOf(doc, v.to) === null;
      if (settledAndFinished) {
        // Nowhere to go from a state you are already resting in: step to the
        // next one, so play always does something visible.
        const index = doc.states.findIndex((s) => s.id === v.to);
        const next = doc.states[(index + 1) % doc.states.length];
        return { ...v, from: v.to, to: next?.id ?? v.to, t: 0, loop: 0, playing: true };
      }
      if (v.t >= 1 && sustainOf(doc, v.to) === null) return { ...v, t: 0, playing: true };
      return { ...v, playing: true };
    });
  };

  const goTo = (stateId: string) => {
    setView((v) => {
      if (stateId === v.to) return { ...v, t: 1, loop: 0, playing: false };
      return {
        ...v,
        from: v.to,
        to: stateId,
        t: 0,
        loop: 0,
        cycling: false,
        playing: !v.reducedMotion,
      };
    });
  };

  return (
    <div
      className="flex h-8.5 flex-none items-center gap-2"
      style={{ width: Math.max((ARTBOARD_PX * view.zoom) / 100, MIN_STRIP_PX) }}
    >
      <button
        type="button"
        aria-label={view.playing ? 'Pause' : 'Play'}
        title="Play / pause"
        disabled={view.reducedMotion || empty}
        onClick={play}
        className="flex size-6.5 flex-none items-center justify-center rounded-md border-1 border-gray-6 bg-surface-raised text-gray-12 disabled:opacity-40"
      >
        <PlayGlyph playing={view.playing} />
      </button>

      <div className="flex flex-none items-center gap-0.5 rounded-lg border-1 border-gray-6 p-0.5">
        <button
          type="button"
          aria-pressed={view.cycling}
          title="Play every state in order"
          onClick={() =>
            setView((v) => {
              if (v.cycling) return { ...v, cycling: false, playing: false };
              const index = doc.states.findIndex((s) => s.id === v.to);
              const next = doc.states[(index + 1) % doc.states.length];
              return {
                ...v,
                cycling: true,
                reducedMotion: false,
                from: v.to,
                to: next?.id ?? v.to,
                t: 0,
                loop: 0,
                playing: true,
              };
            })
          }
          className={cn(
            'h-6 rounded-md px-2.25 font-mono text-11',
            view.cycling ? 'bg-indigo-3 font-500 text-indigo-9' : 'text-gray-11',
          )}
        >
          all
        </button>
        <span aria-hidden className="mx-0.25 h-3.5 w-px flex-none bg-gray-6" />
        <Tabs
          role="group"
          variant="segment"
          size="md"
          label="States"
          // The chips already sit inside this strip's own hairline group, so
          // the segment's container is suppressed rather than nested.
          className="border-0 p-0"
          items={doc.states.map((s) => ({
            value: s.id,
            label: s.sustain ? `${s.name} ↻` : s.name,
          }))}
          value={view.to}
          previousValue={view.from}
          onChange={goTo}
        />
      </div>

      <StateManager />

      {looping ? (
        <span aria-hidden className="flex-none font-mono text-12 leading-none text-gray-9">
          ↻
        </span>
      ) : null}

      {view.reducedMotion ? (
        <span className="flex-1 font-mono text-10 text-gray-9">
          motion off · holding the {doc.states.find((s) => s.id === view.to)?.name} pose
        </span>
      ) : (
        <Track
          progress={looping ? view.loop : view.t}
          looping={looping}
          disabled={empty}
          onSeek={(value) =>
            setView((v) =>
              looping ? { ...v, loop: value, playing: false } : { ...v, t: value, playing: false },
            )
          }
        />
      )}

      <TimingPopover />

      <span className="flex w-18.5 flex-none flex-col items-end gap-px">
        <span className="font-mono text-9 leading-tight text-gray-11">{lines.top}</span>
        <span className="font-mono text-9 leading-tight text-gray-9">{lines.bottom}</span>
      </span>
    </div>
  );
}

function PlayGlyph({ playing }: { playing: boolean }) {
  return (
    <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      {playing ? (
        <>
          <rect x="1.5" y="0.5" width="2.5" height="9" />
          <rect x="6" y="0.5" width="2.5" height="9" />
        </>
      ) : (
        <polygon points="2,0.5 9,5 2,9.5" />
      )}
    </svg>
  );
}

/**
 * Drives the clock from `requestAnimationFrame` timestamps rather than a fixed
 * interval, so a dropped frame or a 120Hz display does not change how long a
 * transition takes.
 */
function useFrameClock(): void {
  const { state, view, setView } = useEditor();
  const last = useRef<number | null>(null);
  const doc = state.doc;
  const playing = view.playing;

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let frame = requestAnimationFrame(function step(now: number) {
      const elapsed = last.current === null ? 0 : now - last.current;
      last.current = now;
      if (elapsed > 0) setView((v) => ({ ...v, ...tick(doc, v, elapsed) }));
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [doc, playing, setView]);
}
