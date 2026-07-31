import { Popover, PopoverContent, PopoverTrigger, Tabs } from '@tickets/ui';
import { RAMPS, REST_LABELS, RESTS, SPEEDS } from '../doc/constants';
import { useEditor } from '../editor-context';
import type { Ramp, Rest, Speed } from '../doc/types';
import { cycleSeconds, transitionSeconds } from './clock';

/**
 * Timing governs the whole document, so it lives in the transport rather than
 * the right rail — behind a button that shows the value it controls.
 *
 * Three values and nothing else. `ramp` is three named ramps rather than a
 * curve editor, and `rest` spreads the objects' pauses so they never all stop
 * at the same instant.
 */
export function TimingPopover() {
  const { state, dispatch } = useEditor();
  const { timing } = state.doc;

  const rows = [
    {
      label: 'SPEED',
      value: String(timing.speed),
      items: SPEEDS.map((speed) => ({ value: String(speed), label: `${speed}×` })),
      onChange: (value: string) =>
        dispatch({ type: 'setTiming', timing: { speed: Number(value) as Speed } }),
    },
    {
      label: 'RAMP',
      value: timing.ramp,
      items: RAMPS.map((ramp) => ({ value: ramp, label: ramp })),
      onChange: (value: string) => dispatch({ type: 'setTiming', timing: { ramp: value as Ramp } }),
    },
    {
      label: 'REST',
      value: String(timing.rest),
      items: RESTS.map((rest) => ({ value: String(rest), label: REST_LABELS[rest] })),
      onChange: (value: string) =>
        dispatch({ type: 'setTiming', timing: { rest: Number(value) as Rest } }),
    },
  ];

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Timing"
        title="Timing — speed, ramp, rest spread"
        className="flex h-5.5 flex-none items-center rounded-md border-1 border-gray-6 px-1.75 font-mono text-10 text-gray-11"
      >
        {timing.speed}×
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-59 p-0">
        <div className="flex items-center gap-2 border-b-1 border-gray-6 px-3 py-2.5">
          <span className="flex-1 font-sans text-11 font-500 text-gray-12">Timing</span>
          <span className="font-mono text-9 text-gray-9">whole document</span>
        </div>

        <div className="flex flex-col gap-1.75 px-3 pb-1.5 pt-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-11 flex-none font-sans text-9 font-500 tracking-wider text-gray-9">
                {row.label}
              </span>
              <Tabs
                role="group"
                variant="segment"
                size="sm"
                label={row.label}
                className="flex-1 [&>button]:flex-1"
                items={row.items}
                value={row.value}
                onChange={row.onChange}
              />
            </div>
          ))}
        </div>

        <p className="px-3 pb-2.75 pt-0.5 font-mono text-9/relaxed text-gray-9 text-pretty">
          {transitionSeconds(state.doc).toFixed(2)}s transitions ·{' '}
          {cycleSeconds(state.doc).toFixed(2)}s loop ·{' '}
          {timing.rest === 0 ? 'all objects rest together' : 'rests spread across objects'}
        </p>
      </PopoverContent>
    </Popover>
  );
}
