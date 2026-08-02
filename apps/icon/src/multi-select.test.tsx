import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './app';

type User = ReturnType<typeof userEvent.setup>;

/** A place on the artboard, in document units. */
interface Spot {
  x: number;
  y: number;
}

const setup = () => {
  const user = userEvent.setup();
  render(<App />);
  return { user };
};

const objectRail = () => screen.getByRole('complementary', { name: 'Objects' });
const propsRail = () => screen.getByRole('complementary', { name: 'Properties' });
const artboard = () => screen.getByRole('img');

/** The row for an object, which reads as pressed when it is selected. */
const row = (name: string) => within(objectRail()).getByRole('button', { name });

/**
 * Document units to CSS pixels at the default zoom. The artboard has no layout
 * in a test environment, so its own rectangle reads as the origin and a client
 * coordinate is simply the document one scaled.
 */
const SCALE = 448 / 512;

const client = (at: Spot) => ({ button: 0, clientX: at.x * SCALE, clientY: at.y * SCALE });

/** A press, some movement and a release on the artboard, in document units. */
const dragOn = (from: Spot, through: readonly Spot[], modifiers: { shiftKey?: boolean } = {}) => {
  fireEvent.pointerDown(artboard(), { ...client(from), ...modifiers });
  for (const at of through) fireEvent.pointerMove(artboard(), { ...client(at), ...modifiers });
  fireEvent.pointerUp(artboard(), { ...client(through.at(-1) ?? from), ...modifiers });
};

/** A press and a release in the same place. */
const clickOn = (at: Spot, modifiers: { shiftKey?: boolean } = {}) => dragOn(at, [], modifiers);

/** A click with shift held, which is how a selection is added to. */
const shiftClick = async (user: User, target: HTMLElement) => {
  await user.keyboard('{Shift>}');
  await user.click(target);
  await user.keyboard('{/Shift}');
};

const addRect = (user: User) =>
  user.click(within(objectRail()).getByRole('button', { name: 'Rectangle' }));

const setField = async (user: User, label: string, value: string) => {
  const field = within(propsRail()).getByLabelText(label);
  await user.clear(field);
  await user.type(field, value);
  await user.tab();
};

/** Park the one selected rectangle at a place and a size of its own. */
const place = async (user: User, at: Spot, side: number) => {
  await setField(user, 'X', String(at.x));
  await setField(user, 'Y', String(at.y));
  await setField(user, 'Width', String(side));
  await setField(user, 'Height', String(side));
};

/**
 * Two rectangles a hundred units square: `rect 1` at 100, 100 and `rect 2` at
 * 300, 300.
 *
 * Every shape is created in the middle of the board, so they are moved apart
 * through the same fields a user has. Small enough to stay inside the maskable
 * safe zone, because a platform warning takes the status slot over and these
 * tests read what the status slot says.
 *
 * Focus lands back on a row at the end: typing into a field is how they were
 * placed, and a shortcut pressed with a field focused goes into the field.
 */
const twoRects = async (user: User) => {
  await addRect(user);
  await place(user, { x: 100, y: 100 }, 100);
  await addRect(user);
  await place(user, { x: 300, y: 300 }, 100);
  row('rect 1').focus();
};

/**
 * Where each rectangle sits, back to front — read off the picture the exporter
 * draws, which is the document itself spelled the way SVG spells it.
 */
const rectOrigins = () =>
  [...artboard().querySelectorAll('rect')].map(
    (rect) => `${rect.getAttribute('x')},${rect.getAttribute('y')}`,
  );

/** The same, for what each rectangle is painted with. */
const rectFills = () =>
  [...artboard().querySelectorAll('rect')].map((rect) => rect.getAttribute('fill'));

const handleNames = () =>
  within(screen.getByRole('main'))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'))
    .filter((label): label is string => label !== null);

describe('adding to a selection', () => {
  it('shift-clicking a shape adds it, and shift-clicking it again takes it out', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));

    clickOn({ x: 350, y: 350 }, { shiftKey: true });
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'true');

    clickOn({ x: 350, y: 350 }, { shiftKey: true });
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'false');
  });

  it('a plain click replaces the selection, even on a shape already in it', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));
    await shiftClick(user, row('rect 2'));

    clickOn({ x: 150, y: 150 });
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shift-clicking a rail row does what shift-clicking the shape does', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));

    await shiftClick(user, row('rect 2'));
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'true');

    await shiftClick(user, row('rect 2'));
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the marquee', () => {
  it('catches a shape it crosses and leaves a distant one alone', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.keyboard('{Escape}');

    // From bare canvas between the two, across the corner of the far one: it
    // is caught because the band touches it, not because the band holds it.
    dragOn({ x: 250, y: 250 }, [{ x: 350, y: 350 }]);
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'false');
  });

  it('never catches a hidden object, which is not on screen to be aimed at', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(within(objectRail()).getByRole('button', { name: 'Hide rect 2' }));

    dragOn({ x: 0, y: 0 }, [{ x: 450, y: 450 }]);
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds its catch to the selection when shift is held, rather than replacing it', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));

    dragOn({ x: 250, y: 250 }, [{ x: 350, y: 350 }], { shiftKey: true });
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'true');
  });

  it('a press on empty canvas that never travelled is a click, and clears the selection', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));

    clickOn({ x: 250, y: 250 });
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the keyboard', () => {
  it('⌘A takes every visible, unlocked object', async () => {
    const { user } = setup();
    await twoRects(user);
    // A third, left in the middle of the board, then hidden.
    await addRect(user);
    await user.click(within(objectRail()).getByRole('button', { name: 'Hide rect 3' }));
    await user.click(within(objectRail()).getByRole('button', { name: 'Lock rect 2' }));

    await user.keyboard('{Meta>}a{/Meta}');
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'false');
    expect(row('rect 3')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Escape clears the whole selection, however many are in it', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.keyboard('{Control>}a{/Control}');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Escape}');
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'false');
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Backspace takes every selected object, and one undo brings them all back', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));
    await shiftClick(user, row('rect 2'));

    await user.keyboard('{Backspace}');
    expect(within(objectRail()).getByText('— no objects —')).toBeInTheDocument();

    await user.keyboard('{Meta>}z{/Meta}');
    expect(rectOrigins()).toEqual(['100,100', '300,300']);
  });

  it('a selected node still takes the key first, and a second object ends node editing', async () => {
    const { user } = setup();
    /** Press a node handle and let go — the release lands on the artboard,
     * because handles are withdrawn for the duration of a drag. */
    const pressNode = () => {
      const main = screen.getByRole('main');
      fireEvent.pointerDown(within(main).getByRole('button', { name: 'Move point 2' }));
      fireEvent.pointerUp(artboard());
    };

    await user.click(within(objectRail()).getByRole('button', { name: 'Polygon' }));
    await addRect(user);
    await user.click(row('polygon 1'));

    // With the polygon alone and a node of it selected, the key means the node.
    pressNode();
    await user.keyboard('{Backspace}');
    expect(row('polygon 1')).toBeInTheDocument();

    // With the rectangle added to the selection there is no lone shape for a
    // node to belong to, so the key means the objects again — both of them.
    pressNode();
    await shiftClick(user, row('rect 2'));
    await user.keyboard('{Backspace}');
    expect(within(objectRail()).getByText('— no objects —')).toBeInTheDocument();
  });
});

describe('dragging several', () => {
  it('carries every selected shape, and stays absolute across the gesture', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));
    await shiftClick(user, row('rect 2'));

    // Two moves, and the second is measured from the press rather than from
    // the first: the shapes end 60 across and 20 down, not 100 and 70.
    dragOn({ x: 150, y: 150 }, [
      { x: 190, y: 200 },
      { x: 210, y: 170 },
    ]);
    expect(rectOrigins()).toEqual(['160,120', '360,320']);
  });

  it('is one undo entry for the whole gesture, whichever of them was pressed', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));
    await shiftClick(user, row('rect 2'));

    dragOn({ x: 350, y: 350 }, [
      { x: 380, y: 380 },
      { x: 400, y: 400 },
    ]);
    expect(rectOrigins()).toEqual(['150,150', '350,350']);

    await user.keyboard('{Meta>}z{/Meta}');
    expect(rectOrigins()).toEqual(['100,100', '300,300']);
  });

  it('leaves a locked object where it is while the rest of the selection moves', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(within(objectRail()).getByRole('button', { name: 'Lock rect 1' }));
    await user.click(row('rect 1'));
    await shiftClick(user, row('rect 2'));

    dragOn({ x: 350, y: 350 }, [{ x: 390, y: 390 }]);
    expect(rectOrigins()).toEqual(['100,100', '340,340']);
  });
});

describe('the chrome with several selected', () => {
  const selectBoth = async (user: User) => {
    await user.click(row('rect 1'));
    await shiftClick(user, row('rect 2'));
  };

  it('marks every selected row pressed', async () => {
    const { user } = setup();
    await twoRects(user);
    await addRect(user);
    await user.keyboard('{Meta>}a{/Meta}');
    for (const name of ['rect 1', 'rect 2', 'rect 3']) {
      expect(row(name)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('counts in the status line rather than naming one of them', async () => {
    const { user } = setup();
    await twoRects(user);
    expect(screen.getByRole('status')).toHaveTextContent('rect 2 selected');

    await selectBoth(user);
    expect(screen.getByRole('status')).toHaveTextContent('2 objects selected');

    await user.keyboard('{Escape}');
    expect(screen.getByRole('status')).toHaveTextContent('nothing selected');
  });

  // Still none, and now that is an answer rather than a gap: transforming
  // several things at once is what ⌘G is for — it hands back one node with one
  // transform, and that node has handles.
  it('offers no resize or rotate handles, because a group is how you get them', async () => {
    const { user } = setup();
    await twoRects(user);
    expect(handleNames()).toContain('Resize se');

    await selectBoth(user);
    expect(handleNames().filter((name) => name.startsWith('Resize'))).toEqual([]);
    expect(handleNames()).not.toContain('Rotate');
  });

  it('states the count in the properties rail and withdraws the per-shape fields', async () => {
    const { user } = setup();
    await twoRects(user);
    await selectBoth(user);

    expect(within(propsRail()).getByText('2 objects')).toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('X')).not.toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('Width')).not.toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('CORNER RADIUS')).not.toBeInTheDocument();
    // What they do share is still editable.
    expect(within(propsRail()).getByLabelText('FILL light value')).toBeInTheDocument();
    expect(within(propsRail()).getByLabelText('Stroke width')).toBeInTheDocument();
    expect(within(propsRail()).getByLabelText('OPACITY')).toBeInTheDocument();
  });

  it('applies an appearance edit to all of them, as one entry', async () => {
    const { user } = setup();
    await twoRects(user);
    await selectBoth(user);

    await user.click(within(propsRail()).getByRole('button', { name: 'Set fill to #C0382E' }));
    expect(rectFills()).toEqual(['#C0382E', '#C0382E']);

    await user.keyboard('{Meta>}z{/Meta}');
    expect(rectFills()).toEqual(['#4E46C6', '#4E46C6']);
  });

  it('says a shared value is mixed rather than showing one object’s as everyone’s', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));
    await user.click(within(propsRail()).getByRole('button', { name: 'Set fill to #C0382E' }));

    await selectBoth(user);
    expect(within(propsRail()).getByLabelText('FILL light value')).toHaveValue('mixed');
    // And no preset claims to be the selection's colour.
    expect(
      within(propsRail()).getByRole('button', { name: 'Set fill to #C0382E' }),
    ).toHaveAttribute('aria-pressed', 'false');
    // A property they do agree on still reads as itself.
    expect(within(propsRail()).getByLabelText('OPACITY')).toHaveValue('100');
  });

  it('a mixed field is still live: what is typed into it becomes everyone’s', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));
    await user.click(within(propsRail()).getByRole('button', { name: 'Set fill to #C0382E' }));
    await selectBoth(user);

    const hex = within(propsRail()).getByLabelText('FILL light value');
    await user.clear(hex);
    await user.type(hex, '#2E7D4F');
    await user.tab();
    expect(rectFills()).toEqual(['#2E7D4F', '#2E7D4F']);
  });
});
