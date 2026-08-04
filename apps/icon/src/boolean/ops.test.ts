import { describe, expect, it } from 'vitest';
import { NO_TRANSFORM, objectFor } from '../doc/defaults';
import { flattenPath, pointsBox, rotatedBounds } from '../doc/geometry';
import { ARTBOARD_FRAME, frameOf } from '../doc/tree';
import type { Box } from '../doc/geometry';
import type { Geometry, IconGroup, IconNode, IconObject } from '../doc/types';
import { parsePathData } from '../import/parse';
import { combinePlan, combineRefusal, nonZeroWound, operandPath, pathOf } from './ops';

const ARTBOARD = { width: 512, height: 512 };

/** A shape of a given geometry, with everything else at its default. */
const shape = (id: string, geometry: Geometry, extra: Partial<IconObject> = {}): IconObject => ({
  ...objectFor(geometry, 1, ARTBOARD),
  id,
  name: id,
  ...extra,
});

const box = (x: number, y: number, w: number, h: number): Geometry => ({
  kind: 'rect',
  x,
  y,
  w,
  h,
  radius: 0,
});

const group = (id: string, children: IconNode[], transform = NO_TRANSFORM): IconGroup => ({
  id,
  name: id,
  transform: { ...transform },
  opacity: 100,
  hidden: false,
  locked: false,
  children,
});

/** The box a `d` string occupies, measured through the flattener. */
const boxOf = (d: string): Box => pointsBox(flattenPath(parsePathData(d).segments).flat());

/**
 * Two boxes agreeing to `places` decimals.
 *
 * A shape made of arcs is measured through the flattener, whose points all sit
 * *on* the curve — so its box can fall short of the true extreme by as much as
 * `FLATTEN_TOLERANCE`. Anything with a curve in it is compared to the whole
 * unit for that reason and not because the answer is vague.
 */
const near = (actual: Box, expected: Box, places = 2) => {
  expect(actual.x).toBeCloseTo(expected.x, places);
  expect(actual.y).toBeCloseTo(expected.y, places);
  expect(actual.w).toBeCloseTo(expected.w, places);
  expect(actual.h).toBeCloseTo(expected.h, places);
};

describe('a shape as path commands', () => {
  it('writes a box as four corners and a close', () => {
    expect(pathOf(box(10, 20, 100, 40))).toEqual([
      { c: 'M', x: 10, y: 20 },
      { c: 'L', x: 110, y: 20 },
      { c: 'L', x: 110, y: 60 },
      { c: 'L', x: 10, y: 60 },
      { c: 'Z' },
    ]);
  });

  it('cuts a curved corner with an arc rather than mitring it', () => {
    const curved = shape('rect-1', { kind: 'rect', x: 0, y: 0, w: 100, h: 100, radius: 20 });
    const commands = pathOf(curved.geometry);
    expect(commands.filter((command) => command.c === 'A')).toHaveLength(4);
    // It starts one radius along the top edge, and the box it occupies is
    // unchanged — a corner is taken off the box, not added to it.
    expect(commands[0]).toEqual({ c: 'M', x: 20, y: 0 });
    near(
      boxOf(operandPath({ shape: curved, frame: ARTBOARD_FRAME })),
      { x: 0, y: 0, w: 100, h: 100 },
      0,
    );
  });

  it('never lets a corner grow past half the side it sits on', () => {
    // A radius of 90 on a 40-wide box would make two corners of a side overlap;
    // SVG clamps it to half the side, and so does this.
    const commands = pathOf({ kind: 'rect', x: 0, y: 0, w: 40, h: 200, radius: 90 });
    expect(commands[0]).toEqual({ c: 'M', x: 20, y: 0 });
  });

  it('writes a circle as two arcs, because one whole turn has no end', () => {
    const commands = pathOf({ kind: 'circle', cx: 50, cy: 50, r: 30 });
    expect(commands.filter((command) => command.c === 'A')).toHaveLength(2);
    const circle = shape('circle-1', { kind: 'circle', cx: 50, cy: 50, r: 30 });
    near(
      boxOf(operandPath({ shape: circle, frame: ARTBOARD_FRAME })),
      { x: 20, y: 20, w: 60, h: 60 },
      0,
    );
  });

  it('leaves a run that never closed open', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ];
    expect(pathOf({ kind: 'polyline', points }).some((command) => command.c === 'Z')).toBe(false);
    expect(pathOf({ kind: 'polygon', points }).at(-1)).toEqual({ c: 'Z' });
  });
});

describe('an operand in artboard units', () => {
  it('reads its own coordinates when it is upright at the top level', () => {
    const object = shape('rect-1', box(10, 20, 100, 40));
    near(boxOf(operandPath({ shape: object, frame: ARTBOARD_FRAME })), {
      x: 10,
      y: 20,
      w: 100,
      h: 40,
    });
  });

  it('bakes the shape’s own turn in, so nothing downstream carries a rotation', () => {
    const object = shape('rect-1', box(0, 0, 100, 40), { rotation: 90 });
    // Turned a quarter about the centre of its own box, which is what the
    // document means by a rotation — and what `rotatedBounds` already reports.
    near(boxOf(operandPath({ shape: object, frame: ARTBOARD_FRAME })), rotatedBounds(object));
    near(boxOf(operandPath({ shape: object, frame: ARTBOARD_FRAME })), {
      x: 30,
      y: -30,
      w: 40,
      h: 100,
    });
  });

  it('flattens a shape through the group it sits in', () => {
    const child = shape('rect-1', box(0, 0, 100, 40));
    const objects: IconNode[] = [group('group-2', [child], { x: 10, y: 20, rotation: 0, scale: 2 })];

    // The group's scale is about its content centre, which stays at 50, 20 —
    // then the move takes it to 60, 40, with a box twice the size round it.
    near(boxOf(operandPath({ shape: child, frame: frameOf(objects, 'rect-1') })), {
      x: -40,
      y: 0,
      w: 200,
      h: 80,
    });
  });

  it('carries a shape’s own turn and its group’s together, in one map', () => {
    const child = shape('rect-1', box(0, 0, 100, 40), { rotation: 90 });
    const objects: IconNode[] = [group('group-2', [child], { x: 0, y: 0, rotation: 90, scale: 1 })];

    // Two right angles about two different centres. The group's content box is
    // the child's rotated box — 30, −30, 40 × 100 — so the group turns about
    // 50, 20, and the shape's own turn is already inside that.
    near(boxOf(operandPath({ shape: child, frame: frameOf(objects, 'rect-1') })), {
      x: 0,
      y: 0,
      w: 100,
      h: 40,
    });
  });
});

describe('what may be combined', () => {
  const first = shape('rect-1', box(0, 0, 10, 10));
  const second = shape('rect-2', box(20, 20, 10, 10));

  it('refuses a selection of one, because there is nothing to combine it with', () => {
    expect(combineRefusal([first])).toMatch(/two shapes at least/);
    expect(combineRefusal([])).toMatch(/two shapes at least/);
  });

  it('refuses a group and says which key takes one apart', () => {
    expect(combineRefusal([first, group('group-3', [second])])).toMatch(/⇧⌘G/);
  });

  it('allows two shapes', () => {
    expect(combineRefusal([first, second])).toBeNull();
  });
});

describe('the plan a boolean is carried out against', () => {
  const one = shape('rect-1', box(0, 0, 10, 10));
  const two = shape('rect-2', box(20, 20, 10, 10));
  const three = shape('rect-3', box(40, 40, 10, 10));

  it('keeps the operands in the order they were selected', () => {
    const plan = combinePlan([three, two, one], ['rect-1', 'rect-3']);
    expect(plan?.operands.map((operand) => operand.shape.id)).toEqual(['rect-1', 'rect-3']);
  });

  it('takes the frontmost operand as the one whose place the result gets', () => {
    // Selected back-first, so the front is decided by the document rather than
    // by which one was clicked first.
    const plan = combinePlan([three, two, one], ['rect-1', 'rect-3']);
    expect(plan?.front.shape.id).toBe('rect-3');
    // `rect 3` was frontmost of all three, so the result lands at the very
    // front — in front of `rect 2`, which was never an operand.
    expect(plan?.index).toBe(0);
    expect(plan?.remaining.map((node) => node.id)).toEqual(['rect-2']);
  });

  it('counts the result’s place in what survives, not in what was there', () => {
    // `rect 3` stays, and the two behind it become one shape in `rect 2`'s slot.
    const plan = combinePlan([three, two, one], ['rect-1', 'rect-2']);
    expect(plan?.front.shape.id).toBe('rect-2');
    expect(plan?.index).toBe(1);
    expect(plan?.remaining.map((node) => node.id)).toEqual(['rect-3']);
  });

  it('gives an operand inside a group its group’s place, and leaves the group behind', () => {
    const held = group('group-4', [two]);
    const plan = combinePlan([held, one], ['rect-1', 'rect-2']);
    expect(plan?.front.shape.id).toBe('rect-2');
    // The group is what stood between the operand and the artboard, so its slot
    // is where the result belongs once the operand is lifted out of it.
    expect(plan?.index).toBe(0);
    expect(plan?.remaining.map((node) => node.id)).toEqual(['group-4']);
    const survivor = plan?.remaining[0];
    expect(survivor && 'children' in survivor ? survivor.children : null).toEqual([]);
  });

  it('has no plan for a group, for one shape, or for an id naming nothing', () => {
    expect(combinePlan([group('group-4', [two]), one], ['rect-1', 'group-4'])).toBeNull();
    expect(combinePlan([two, one], ['rect-1'])).toBeNull();
    expect(combinePlan([two, one], ['rect-1', 'rect-9'])).toBeNull();
  });
});

describe('winding a result the way non-zero reads it', () => {
  /** Two squares, the second inside the first, both turning the same way. */
  const NESTED = 'M0 0 L100 0 L100 100 L0 100 Z M20 20 L80 20 L80 80 L20 80 Z';

  const areas = (segments: ReturnType<typeof nonZeroWound>) =>
    flattenPath(segments).map((run) =>
      run.reduce((sum, point, index) => {
        const previous = run[(index + run.length - 1) % run.length] ?? point;
        return sum + (previous.x - point.x) * (previous.y + point.y);
      }, 0),
    );

  it('turns a hole against the body that holds it', () => {
    const wound = areas(nonZeroWound(parsePathData(NESTED).segments));
    expect(wound).toHaveLength(2);
    expect(Math.sign(wound[0] ?? 0)).not.toBe(Math.sign(wound[1] ?? 0));
  });

  it('leaves an outline that already alternates exactly as it was', () => {
    const once = nonZeroWound(parsePathData(NESTED).segments);
    expect(nonZeroWound(once)).toEqual(once);
  });

  it('leaves a single contour alone, since there is nothing for it to disagree with', () => {
    const only = parsePathData('M0 0 L100 0 L100 100 Z').segments;
    expect(nonZeroWound(only)).toEqual(only);
  });

  it('reverses a curve along itself rather than approximating it', () => {
    // A body with a curved hole. Reversing must not move the outline, so the
    // box it occupies is the same before and after.
    const curved = 'M0 0 L100 0 L100 100 L0 100 Z M50 20 C70 20 80 30 80 50 C80 70 50 80 50 80 Z';
    const before = pointsBox(flattenPath(parsePathData(curved).segments).flat());
    const after = pointsBox(flattenPath(nonZeroWound(parsePathData(curved).segments)).flat());
    near(after, before);
  });

  it('leaves two contours side by side alone, because neither is inside the other', () => {
    const apart = parsePathData('M0 0 L10 0 L10 10 Z M50 50 L60 50 L60 60 Z').segments;
    expect(nonZeroWound(apart)).toEqual(apart);
  });
});
