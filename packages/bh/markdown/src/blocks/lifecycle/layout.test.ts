import { noBlocks, toExample } from '../../registry';
import { parseDocument } from '../../parse';
import { describe, expect, it } from 'vitest';
import { lifecycleExamples } from './examples';
import { LABEL_HEIGHT, NODE_HEIGHT, layoutStates, type Box, type Layout } from './layout';
import { lifecycleBlock } from './renderer';
import type { LifecycleData } from './schema';

const registry = noBlocks.register({ lifecycle: lifecycleBlock });

const overlap = (a: Box, b: Box) => {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
};

const boxOf = (layout: Layout, state: string): Box => {
  const { x, y } = layout.pos[state] ?? { x: NaN, y: NaN };
  return { x, y, width: layout.nodeWidth, height: NODE_HEIGHT };
};

describe('layoutStates', () => {
  it('puts each state one column right of the state that reaches it soonest', () => {
    const { pos, columnWidth } = layoutStates({
      initial: 'queued',
      states: { queued: { start: 'running', skip: 'done' }, running: { finish: 'done' }, done: {} },
    });
    expect(pos.queued?.x).toBe(0);
    expect(pos.running?.x).toBe(columnWidth);
    // `skip` reaches `done` in one step, so it sits beside `running`, not after it.
    expect(pos.done?.x).toBe(columnWidth);
  });

  it('stacks states that share a column, in the order they are declared', () => {
    const { pos } = layoutStates({
      initial: 'a',
      states: { a: { x: 'b', y: 'c' }, b: {}, c: {} },
    });
    expect(pos.b?.x).toBe(pos.c?.x);
    expect(pos.c?.y).toBeGreaterThan(pos.b?.y ?? Infinity);
  });

  it('pins an unreachable state to the first column and names it', () => {
    const { pos, unreachable } = layoutStates({ initial: 'a', states: { a: {}, orphan: {} } });
    expect(unreachable).toEqual(['orphan']);
    expect(pos.orphan?.x).toBe(0);
  });

  it('does not take an inherited Object property for a state', () => {
    const layout = layoutStates({ initial: 'a', states: { a: { build: 'toString' } } });
    expect(layout.wires).toEqual([]);
    expect(Object.keys(layout.pos)).toEqual(['a']);
  });

  it('lays out a state named after an Object property like any other', () => {
    const layout = layoutStates({ initial: 'a', states: { a: { go: 'toString' }, toString: {} } });
    expect(layout.unreachable).toEqual([]);
    expect(layout.wires.map((wire) => wire.to)).toEqual(['toString']);
  });

  it('routes each wire by where its target sits', () => {
    const { wires } = layoutStates({
      initial: 'a',
      states: { a: { on: 'b', side: 'c', again: 'a' }, b: { back: 'a', over: 'c' }, c: {} },
    });
    expect(Object.fromEntries(wires.map((wire) => [wire.event, wire.route]))).toEqual({
      on: 'forward',
      side: 'forward',
      again: 'self',
      back: 'back',
      over: 'column',
    });
  });

  it("ends every wire's arrowhead on the edge of its target", () => {
    const model: Pick<LifecycleData, 'initial' | 'states'> = {
      initial: 'a',
      states: {
        a: { on: 'b', side: 'c', again: 'a' },
        b: { back: 'a', over: 'c' },
        c: { up: 'a' },
      },
    };
    const layout = layoutStates(model);
    for (const wire of layout.wires) {
      const { x, y, width, height } = boxOf(layout, wire.to);
      const onSide = (wire.tip.x === x || wire.tip.x === x + width) && wire.tip.y >= y;
      const onEnd = (wire.tip.y === y || wire.tip.y === y + height) && wire.tip.x >= x;
      expect(onSide || onEnd, `${wire.event} ends on ${wire.to}`).toBe(true);
      expect(wire.tip.x).toBeLessThanOrEqual(x + width);
      expect(wire.tip.y).toBeLessThanOrEqual(y + height);
    }
  });

  it('marks the way in to the initial state', () => {
    const layout = layoutStates({ initial: 'b', states: { a: {}, b: { go: 'a' } } });
    const initial = boxOf(layout, 'b');
    expect(layout.entry?.dot.y).toBe(initial.y + NODE_HEIGHT / 2);
    expect(layout.entry?.dot.x).toBeLessThan(initial.x);
    expect(layout.bounds.x).toBeLessThan(initial.x);
  });

  it('widens the gap between columns to hold the longest event name on it', () => {
    const short = layoutStates({ initial: 'a', states: { a: { go: 'b' }, b: {} } });
    const long = layoutStates({
      initial: 'a',
      states: { a: { escalate_to_the_review_board: 'b' }, b: {} },
    });
    expect(long.columnWidth).toBeGreaterThan(short.columnWidth);
    const [wire] = long.wires;
    expect(wire?.label.x).toBeGreaterThanOrEqual(long.nodeWidth);
    expect((wire?.label.x ?? 0) + (wire?.label.width ?? 0)).toBeLessThanOrEqual(long.columnWidth);
  });

  it('widens a state to hold the longest state name', () => {
    const layout = layoutStates({
      initial: 'awaiting_a_second_signature',
      states: { awaiting_a_second_signature: {} },
    });
    expect(layout.nodeWidth).toBeGreaterThan('awaiting_a_second_signature'.length * 7);
  });

  it('arcs back over the row, a lane each, and loops under the state', () => {
    const layout = layoutStates({
      initial: 'a',
      states: { a: { next: 'b' }, b: { on: 'c', stay: 'b' }, c: { reset: 'a', undo: 'b' } },
    });
    const wire = (event: string) => layout.wires.find((w) => w.event === event);
    const [reset, undo, stay] = [wire('reset'), wire('undo'), wire('stay')];
    const row = boxOf(layout, 'a');
    for (const arc of [reset, undo]) {
      expect(arc?.route).toBe('back');
      expect(arc?.tip.y).toBe(row.y);
      expect((arc?.label.y ?? Infinity) + LABEL_HEIGHT).toBeLessThanOrEqual(row.y);
    }
    expect(reset && undo && overlap(reset.label, undo.label)).toBe(false);
    expect(stay?.route).toBe('self');
    expect(stay?.label.y).toBeGreaterThanOrEqual(row.y + NODE_HEIGHT);
  });

  it.each(lifecycleExamples.map((example) => [toExample(example).heading ?? '', example]))(
    'keeps every label clear of the states and of each other: %s',
    (_, example) => {
      const data = parseDocument(toExample(example).source, registry).blocks[0]?.data;
      const layout = layoutStates(data as LifecycleData);
      const states = Object.keys(layout.pos).map((state) => boxOf(layout, state));
      const labels = layout.wires.map((wire) => wire.label);
      labels.forEach((label, index) => {
        expect(states.some((state) => overlap(label, state))).toBe(false);
        expect(labels.some((other, at) => at !== index && overlap(label, other))).toBe(false);
      });
    },
  );

  it('holds everything it draws inside its bounds', () => {
    const layout = layoutStates({
      initial: 'a',
      states: { a: { go: 'b' }, b: { stay: 'b', down: 'c' }, c: {} },
    });
    const { x, y, width, height } = layout.bounds;
    const inside = (box: Box) => {
      return (
        box.x >= x &&
        box.y >= y &&
        box.x + box.width <= x + width &&
        box.y + box.height <= y + height
      );
    };
    for (const state of Object.keys(layout.pos)) {
      expect(inside(boxOf(layout, state))).toBe(true);
    }
    for (const wire of layout.wires) {
      expect(inside(wire.label)).toBe(true);
    }
  });
});
