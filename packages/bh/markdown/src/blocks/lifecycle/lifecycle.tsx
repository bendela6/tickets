import { parseDocument } from '../../parse';
import { renderNodes, useDocContext } from '../../render';
import { useEffect, useMemo, useState } from 'react';
import { BlockBar, BlockFrame, BlockTitle, Kicker } from '../parts';
import { ENTRY_RADIUS, layoutStates, monoAdvance, NODE_HEIGHT, type MeasureText } from './layout';
import type { LifecycleData } from './schema';

// A state is a raised card on the canvas, its name in mono since it is a name
// in code. The initial state is filled indigo and has the entry mark leading
// into it; a final one wears a second rule; one nothing leads to is dashed.
// Whole class strings, since Tailwind sees only whole names: each mark is a
// data attribute and the class answers to it.
const STATE =
  'absolute flex items-center justify-center rounded-6 border-1 border-gray-7 bg-surface-raised px-14 font-mono text-12 whitespace-nowrap text-gray-12 shadow-xs ' +
  'data-[final=true]:border-gray-8 data-[final=true]:outline-1 data-[final=true]:outline-offset-2 data-[final=true]:outline-gray-8 ' +
  'data-[initial=true]:border-indigo-7 data-[initial=true]:bg-indigo-3 data-[initial=true]:font-500 data-[initial=true]:text-indigo-11 data-[initial=true]:outline-indigo-7 ' +
  'data-[unreachable=true]:border-dashed';

/**
 * The app's mono font, measured, for the names drawn in it: whichever font the
 * app chose. The first render lays out by `monoAdvance`, as a page drawn ahead
 * of its code was; then by the font itself, and again once the fonts load.
 */
function useMonoMeasure(): MeasureText {
  const [measure, setMeasure] = useState<MeasureText>(() => monoAdvance);
  useEffect(() => {
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-mono');
    const context =
      typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d');
    if (!context || !family.trim()) {
      return undefined;
    }
    let live = true;
    const take = () => {
      const widths = new Map<string, number>();
      setMeasure(() => {
        return (text: string, size: number) => {
          const key = `${size} ${text}`;
          let width = widths.get(key);
          if (width === undefined) {
            context.font = `${size}px ${family}`;
            width = context.measureText(text).width;
            widths.set(key, width);
          }
          return width;
        };
      });
    };
    take();
    void document.fonts.ready.then(() => {
      if (live) {
        take();
      }
    });
    return () => {
      live = false;
    };
  }, []);
  return measure;
}

/** What a screen reader hears after a state's name: its marks, and where each event leads. */
function describe(
  state: string,
  events: Record<string, string>,
  marks: { initial: boolean; final: boolean; unreachable: boolean },
): string {
  const parts: string[] = [];
  if (marks.initial) {
    parts.push('start state');
  }
  if (marks.final) {
    parts.push('end state');
  }
  if (marks.unreachable) {
    parts.push('no event leads here');
  }
  for (const [event, to] of Object.entries(events)) {
    parts.push(to === state ? `${event} stays here` : `${event} leads to ${to}`);
  }
  return parts.length > 0 ? `: ${parts.join('; ')}` : '';
}

/** The marks the diagram uses, named in the bar. */
function Legend({ ends }: { ends: boolean }) {
  return (
    <span aria-hidden="true" className="ml-auto flex shrink-0 items-center gap-12">
      <Kicker as="span" className="flex items-center gap-6">
        <span className="bg-indigo-9 size-7 rounded-full" />
        Start
      </Kicker>
      {ends ? (
        <Kicker as="span" className="flex items-center gap-6">
          <span className="rounded-2 border-gray-8 outline-gray-8 size-9 border-1 outline-1 outline-offset-1" />
          End
        </Kicker>
      ) : null}
    </span>
  );
}

/** The notes under the diagram: markdown, drawn with the host's elements. */
function Notes({ text }: { text: string }) {
  const { registry, elements } = useDocContext();
  const nodes = useMemo(() => {
    return parseDocument(text, registry).nodes;
  }, [text, registry]);
  return (
    <div className="border-gray-6 text-14/22 text-gray-11 border-t-1 px-16 py-12 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      {renderNodes(nodes, elements, 'lifecycle-notes')}
    </div>
  );
}

/**
 * A state machine: its states in columns, left to right in the order things
 * happen, joined by a wire per event with the event's name on it. Under the
 * drawing, the notes.
 */
export function Lifecycle({ data }: { data: LifecycleData }) {
  const measure = useMonoMeasure();
  const layout = useMemo(() => layoutStates(data, measure), [data, measure]);
  const { bounds, nodeWidth, wires, entry } = layout;
  const finals = new Set(data.final ?? []);
  const unreachable = new Set(layout.unreachable);
  // Everything is laid out from the initial column's left edge; the canvas starts at the bounds.
  const shift = `translate(${-bounds.x} ${-bounds.y})`;

  return (
    <BlockFrame>
      <BlockBar>
        {data.title ? <BlockTitle>{data.title}</BlockTitle> : null}
        <Legend ends={finals.size > 0} />
      </BlockBar>

      <div className="bg-gray-2 overflow-x-auto p-16">
        <div className="relative mx-auto" style={{ width: bounds.width, height: bounds.height }}>
          <svg
            aria-hidden="true"
            className="absolute inset-0 overflow-visible"
            width={bounds.width}
            height={bounds.height}
          >
            <g transform={shift}>
              {entry ? (
                <g>
                  <circle
                    cx={entry.dot.x}
                    cy={entry.dot.y}
                    r={ENTRY_RADIUS}
                    className="fill-indigo-9"
                  />
                  <path d={entry.path} className="stroke-indigo-9 fill-none" strokeWidth={1.25} />
                  <path d={entry.arrow} className="fill-indigo-9" />
                </g>
              ) : null}
              {wires.map((wire, index) => {
                return (
                  <g
                    key={index}
                    data-testid="lifecycle-edge"
                    data-from={wire.from}
                    data-to={wire.to}
                    data-event={wire.event}
                    data-route={wire.route}
                  >
                    <path
                      d={wire.path}
                      className="stroke-gray-8 fill-none"
                      strokeWidth={1.25}
                      strokeLinecap="round"
                    />
                    <path d={wire.arrow} className="fill-gray-8" />
                  </g>
                );
              })}
              {/* The names after every wire, so a wire never runs over a name; each
                  sits on a patch of the canvas that breaks the wires beneath it. */}
              {wires.map(({ event, label }, index) => {
                return (
                  <g key={index}>
                    <rect
                      x={label.x}
                      y={label.y}
                      width={label.width}
                      height={label.height}
                      rx={4}
                      className="fill-gray-2"
                    />
                    <text
                      x={label.x + label.width / 2}
                      y={label.y + label.height / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-gray-11 text-11 font-mono"
                    >
                      {event}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <ul aria-label={data.title ? `${data.title}: states` : 'States'}>
            {Object.entries(data.states).map(([state, events]) => {
              const marks = {
                initial: state === data.initial,
                final: finals.has(state),
                unreachable: unreachable.has(state),
              };
              const at = layout.pos[state] ?? { x: 0, y: 0 };
              return (
                <li
                  key={state}
                  data-testid={`state-${state}`}
                  data-state={state}
                  data-initial={marks.initial ? 'true' : undefined}
                  data-final={marks.final ? 'true' : undefined}
                  data-unreachable={marks.unreachable ? 'true' : undefined}
                  className={STATE}
                  style={{
                    left: at.x - bounds.x,
                    top: at.y - bounds.y,
                    width: nodeWidth,
                    height: NODE_HEIGHT,
                  }}
                >
                  {state}
                  <span className="sr-only">{describe(state, events, marks)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {data.notes ? <Notes text={data.notes} /> : null}
    </BlockFrame>
  );
}
