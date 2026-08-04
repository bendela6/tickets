import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import type { BooleanEngine, BooleanOp } from './boolean/ops';
import { flattenPath, pointsBox } from './doc/geometry';
import { parsePathData } from './import/parse';

type User = ReturnType<typeof userEvent.setup>;

/**
 * The four operations, everywhere except inside the engine.
 *
 * The engine is a fake here, and that is the whole point of it being one
 * function: what the operands are, which order they arrive in, where the answer
 * lands, what it is painted with and what one undo takes back are all decisions
 * this app makes, and none of them needs Skia to be running to be checked.
 * `boolean/engine.test.ts` runs the real module, and only it does.
 */

/** A square the fake answers with, well clear of anything the tests place. */
const ANSWER = 'M10 10 L90 10 L90 90 L10 90 Z';

interface Asked {
  op: BooleanOp;
  paths: string[];
}

const setup = (answer: string | (() => Promise<string>) = ANSWER) => {
  const user = userEvent.setup();
  const asked: Asked[] = [];
  const engine: BooleanEngine = (op, paths) => {
    asked.push({ op, paths: [...paths] });
    return typeof answer === 'string' ? Promise.resolve(answer) : answer();
  };
  render(<App engine={engine} />);
  return { user, asked };
};

const objectRail = () => screen.getByRole('complementary', { name: 'Objects' });
const propsRail = () => screen.getByRole('complementary', { name: 'Properties' });
const artboard = () => screen.getByRole('img');

const row = (name: string) => within(objectRail()).getByRole('button', { name });
const operation = (name: string) => within(propsRail()).getByRole('button', { name });

/** Every row's name, front to back — which is the order the rail draws them. */
const rowNames = () =>
  within(objectRail())
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');

/** What the exporter draws for the one path in the document. */
const drawnPath = () => artboard().querySelector('path');

const boxOf = (d: string) => pointsBox(flattenPath(parsePathData(d).segments).flat());

const addRect = (user: User) =>
  user.click(within(objectRail()).getByRole('button', { name: 'Rectangle' }));

const setField = async (user: User, label: string, value: string) => {
  const field = within(propsRail()).getByLabelText(label);
  await user.clear(field);
  await user.type(field, value);
  await user.tab();
};

/**
 * Park the one selected rectangle at a place and a size of its own, with square
 * corners.
 *
 * The corner is flattened because a new rectangle arrives with a 32-unit curve
 * on each one, and these tests measure boxes: a curved corner is exactly what
 * the operand path is supposed to carry, and it is measured on its own in
 * `boolean/ops.test.ts`. Here it would only make every expected number an
 * approximation of one.
 */
const place = async (user: User, at: { x: number; y: number }, side: number) => {
  await setField(user, 'X', String(at.x));
  await setField(user, 'Y', String(at.y));
  await setField(user, 'Width', String(side));
  await setField(user, 'Height', String(side));
  await setField(user, 'CORNER RADIUS', '0');
};

const shiftClick = async (user: User, target: HTMLElement) => {
  await user.keyboard('{Shift>}');
  await user.click(target);
  await user.keyboard('{/Shift}');
};

/** `rect 1` at 100,100 and `rect 2` at 300,300, both a hundred units square. */
const twoRects = async (user: User) => {
  await addRect(user);
  await place(user, { x: 100, y: 100 }, 100);
  await addRect(user);
  await place(user, { x: 300, y: 300 }, 100);
  row('rect 1').focus();
};

const selectBoth = async (user: User) => {
  await user.click(row('rect 1'));
  await shiftClick(user, row('rect 2'));
};

describe('when the operations are offered', () => {
  it('withholds them from one shape, and says what they would need', async () => {
    const { user } = setup();
    await addRect(user);

    expect(operation('Union')).toBeDisabled();
    expect(operation('Subtract')).toBeDisabled();
    expect(within(propsRail()).getByText(/two shapes at least/)).toBeInTheDocument();
  });

  it('offers all four once two shapes are selected', async () => {
    const { user } = setup();
    await twoRects(user);
    await selectBoth(user);

    for (const name of ['Union', 'Subtract', 'Intersect', 'Exclude']) {
      expect(operation(name)).toBeEnabled();
    }
    expect(within(propsRail()).queryByText(/two shapes at least/)).not.toBeInTheDocument();
  });

  it('withholds them from a selection holding a group, and says which key opens one', async () => {
    const { user } = setup();
    await twoRects(user);
    await addRect(user);
    // `rect 1` and `rect 2` become a group, which is then selected alongside
    // the third shape.
    await selectBoth(user);
    await user.keyboard('{Meta>}g{/Meta}');
    await shiftClick(user, row('rect 3'));

    expect(operation('Union')).toBeDisabled();
    const reason = within(propsRail()).getByText(/⇧⌘G/);
    expect(reason).toBeInTheDocument();
    expect(operation('Union')).toHaveAttribute('aria-describedby', reason.id);
  });

  it('offers nothing at all with nothing selected', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.keyboard('{Escape}');
    expect(within(propsRail()).queryByRole('button', { name: 'Union' })).not.toBeInTheDocument();
  });
});

describe('what the engine is asked', () => {
  it('sends the operands in the order they were selected', async () => {
    const { user, asked } = setup();
    await twoRects(user);
    // `rect 2` first, so the base is the one at 300,300 — which is the whole of
    // what makes a subtract predictable.
    await user.click(row('rect 2'));
    await shiftClick(user, row('rect 1'));
    await user.click(operation('Subtract'));

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.op).toBe('subtract');
    expect(asked[0]?.paths.map((d) => boxOf(d).x)).toEqual([300, 100]);
  });

  it('bakes an operand’s own turn in before the operation', async () => {
    const { user, asked } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));
    await setField(user, 'ROTATION', '45');
    await shiftClick(user, row('rect 2'));
    await user.click(operation('Union'));

    await waitFor(() => expect(asked).toHaveLength(1));
    // A hundred-unit square turned 45° reaches √2 × 100 corner to corner, and
    // sits centred where it was. Nothing downstream is told about a rotation.
    const turned = boxOf(asked[0]?.paths[0] ?? '');
    expect(turned.w).toBeCloseTo(Math.SQRT2 * 100, 1);
    expect(turned.x).toBeCloseTo(150 - (Math.SQRT2 * 100) / 2, 1);
  });

  it('flattens an operand through the group it sits in', async () => {
    const { user, asked } = setup();
    await twoRects(user);
    // `rect 1` goes into a group of its own, and the group is then moved 200
    // units across — which its child's own coordinates know nothing about.
    await user.click(row('rect 1'));
    await user.keyboard('{Meta>}g{/Meta}');
    await setField(user, 'X', '200');

    await user.click(row('rect 1'));
    await shiftClick(user, row('rect 2'));
    await user.click(operation('Union'));

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(boxOf(asked[0]?.paths[0] ?? '').x).toBeCloseTo(300, 3);
  });
});

describe('what the answer becomes', () => {
  it('replaces every operand with one path, selected and named for the operation', async () => {
    const { user } = setup();
    await twoRects(user);
    await selectBoth(user);
    await user.click(operation('Union'));

    await waitFor(() => expect(rowNames()).toEqual(['union 3']));
    expect(row('union 3')).toHaveAttribute('aria-pressed', 'true');
    expect(within(propsRail()).getByText('PATH')).toBeInTheDocument();
  });

  it('reads the engine’s answer back through the importer’s own parser', async () => {
    // Shorthand commands, which the document has no way to store: if they are
    // still shorthand by the time they are drawn, nothing parsed them.
    const { user } = setup('M10 10 H90 V90 H10 Z');
    await twoRects(user);
    await selectBoth(user);
    await user.click(operation('Intersect'));

    await waitFor(() => expect(drawnPath()).not.toBeNull());
    expect(drawnPath()?.getAttribute('d')).toBe('M 10 10 L 90 10 L 90 90 L 10 90 Z');
  });

  it('lands where the frontmost operand was, painted the way that one was', async () => {
    const { user } = setup();
    await twoRects(user);
    await addRect(user);
    await place(user, { x: 20, y: 20 }, 60);
    // The frontmost shape is given a colour of its own, and is then selected
    // *last* — so the paint cannot have come from the order they were picked.
    await user.click(within(propsRail()).getByRole('button', { name: 'Set fill to #C0382E' }));
    await user.click(row('rect 1'));
    await shiftClick(user, row('rect 3'));
    await user.click(operation('Union'));

    // `rect 2` was never an operand and was in front of `rect 1`; the result
    // still comes out in front of it, because `rect 3` was.
    await waitFor(() => expect(rowNames()).toEqual(['union 4', 'rect 2']));
    expect(drawnPath()?.getAttribute('fill')).toBe('#C0382E');
  });

  it('is one undo entry, however many shapes went into it', async () => {
    const { user } = setup();
    await twoRects(user);
    await selectBoth(user);
    await user.click(operation('Exclude'));
    await waitFor(() => expect(rowNames()).toEqual(['exclude 3']));

    await user.keyboard('{Meta>}z{/Meta}');
    expect(rowNames()).toEqual(['rect 2', 'rect 1']);
    expect(
      [...artboard().querySelectorAll('rect')].map((rect) => rect.getAttribute('x')),
    ).toEqual(['100', '300']);
  });

  it('says so when an operation leaves nothing behind, and changes nothing', async () => {
    const { user } = setup('');
    await twoRects(user);
    await selectBoth(user);
    await user.click(operation('Intersect'));

    await waitFor(() =>
      expect(within(propsRail()).getByText(/leaves nothing behind/)).toBeInTheDocument(),
    );
    expect(rowNames()).toEqual(['rect 2', 'rect 1']);
  });

  it('says so when the engine refuses, and changes nothing', async () => {
    const { user } = setup(() => Promise.reject(new Error('wasm said no')));
    await twoRects(user);
    await selectBoth(user);
    await user.click(operation('Union'));

    await waitFor(() =>
      expect(within(propsRail()).getByText(/could not be worked out/)).toBeInTheDocument(),
    );
    expect(rowNames()).toEqual(['rect 2', 'rect 1']);
  });
});
