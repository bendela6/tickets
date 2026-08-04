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

/** The row for a node, which reads as pressed when it is selected. */
const row = (name: string) => within(objectRail()).getByRole('button', { name });

const maybeRow = (name: string) => within(objectRail()).queryByRole('button', { name });

/**
 * Every row's name and how deep it is, top to bottom — which is the tree the
 * rail draws, read the way a screen reader reads it.
 */
const rowLevels = () =>
  within(objectRail())
    .getAllByRole('listitem')
    .map((item) => `${item.getAttribute('aria-level')}:${item.textContent}`);

/** Document units to CSS pixels at the default zoom, as in multi-select.test. */
const SCALE = 448 / 512;

const client = (at: Spot) => ({ button: 0, clientX: at.x * SCALE, clientY: at.y * SCALE });

const clickOn = (at: Spot, modifiers: { shiftKey?: boolean } = {}) => {
  fireEvent.pointerDown(artboard(), { ...client(at), ...modifiers });
  fireEvent.pointerUp(artboard(), { ...client(at), ...modifiers });
};

const dragOn = (from: Spot, through: readonly Spot[]) => {
  fireEvent.pointerDown(artboard(), client(from));
  for (const at of through) fireEvent.pointerMove(artboard(), client(at));
  fireEvent.pointerUp(artboard(), client(through.at(-1) ?? from));
};

const doubleClickOn = (at: Spot) => fireEvent.doubleClick(artboard(), client(at));

const addRect = (user: User) =>
  user.click(within(objectRail()).getByRole('button', { name: 'Rectangle' }));

const setField = async (user: User, label: string, value: string) => {
  const field = within(propsRail()).getByLabelText(label);
  await user.clear(field);
  await user.type(field, value);
  await user.tab();
};

const place = async (user: User, at: Spot, side: number) => {
  await setField(user, 'X', String(at.x));
  await setField(user, 'Y', String(at.y));
  await setField(user, 'Width', String(side));
  await setField(user, 'Height', String(side));
};

/** `rect 1` at 100,100 and `rect 2` at 300,300, both a hundred units square. */
const twoRects = async (user: User) => {
  await addRect(user);
  await place(user, { x: 100, y: 100 }, 100);
  await addRect(user);
  await place(user, { x: 300, y: 300 }, 100);
  row('rect 1').focus();
};

/** Where each rectangle sits, back to front, read off the picture that is drawn. */
const rectOrigins = () =>
  [...artboard().querySelectorAll('rect')].map(
    (rect) => `${rect.getAttribute('x')},${rect.getAttribute('y')}`,
  );

/** The transform on each `<g>` in the drawing, outermost first. */
const groupTransforms = () =>
  [...artboard().querySelectorAll('g')].map((g) => g.getAttribute('transform') ?? '');

const handleNames = () =>
  within(screen.getByRole('main'))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'))
    .filter((label): label is string => label !== null);

/** Select both rectangles and collect them. The group is named `group 3`. */
const groupBoth = async (user: User) => {
  await user.keyboard('{Meta>}a{/Meta}');
  await user.keyboard('{Meta>}g{/Meta}');
};

describe('making and unmaking a group', () => {
  it('⌘G collects the selection into one row, and ⇧⌘G puts it back', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    expect(row('group 3')).toHaveAttribute('aria-pressed', 'true');
    expect(rowLevels()).toEqual(['1:group 3', '2:rect 2', '2:rect 1']);

    await user.keyboard('{Meta>}{Shift>}g{/Shift}{/Meta}');
    expect(maybeRow('group 3')).toBeNull();
    expect(rowLevels()).toEqual(['1:rect 2', '1:rect 1']);
    // And the picture never moved, either way.
    expect(rectOrigins()).toEqual(['100,100', '300,300']);
  });

  it('one undo takes the whole grouping back', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);
    await user.keyboard('{Meta>}z{/Meta}');
    expect(maybeRow('group 3')).toBeNull();
    expect(rectOrigins()).toEqual(['100,100', '300,300']);
  });

  it('a group draws as a `<g>` holding its children', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);
    expect(artboard().querySelectorAll('g')).toHaveLength(1);
    expect(artboard().querySelectorAll('g rect')).toHaveLength(2);
  });

  it('a group inside a group nests', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);
    await user.keyboard('{Meta>}g{/Meta}');
    expect(rowLevels()).toEqual(['1:group 4', '2:group 3', '3:rect 2', '3:rect 1']);
    expect(artboard().querySelectorAll('g g rect')).toHaveLength(2);
  });
});

describe('standing inside a group', () => {
  const enteredTwo = async (user: User) => {
    await twoRects(user);
    await groupBoth(user);
  };

  it('clicking selects the group, not the shape inside it', async () => {
    const { user } = setup();
    await enteredTwo(user);
    await user.keyboard('{Escape}');

    clickOn({ x: 150, y: 150 });
    expect(row('group 3')).toHaveAttribute('aria-pressed', 'true');
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'false');
  });

  it('double-click enters it, and clicks then select its children directly', async () => {
    const { user } = setup();
    await enteredTwo(user);

    doubleClickOn({ x: 150, y: 150 });
    expect(within(objectRail()).getByText('inside group 3')).toBeInTheDocument();
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');

    clickOn({ x: 350, y: 350 });
    expect(row('rect 2')).toHaveAttribute('aria-pressed', 'true');
    expect(row('group 3')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Escape steps out one level, leaving the group you were in selected', async () => {
    const { user } = setup();
    await enteredTwo(user);
    doubleClickOn({ x: 150, y: 150 });
    expect(within(objectRail()).getByText('inside group 3')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(within(objectRail()).queryByText('inside group 3')).toBeNull();
    expect(row('group 3')).toHaveAttribute('aria-pressed', 'true');

    // A second press has no level left to leave, so it clears the selection.
    await user.keyboard('{Escape}');
    expect(row('group 3')).toHaveAttribute('aria-pressed', 'false');
  });

  it('steps out one level at a time through a nest', async () => {
    const { user } = setup();
    await enteredTwo(user);
    await user.keyboard('{Meta>}g{/Meta}');

    doubleClickOn({ x: 150, y: 150 });
    doubleClickOn({ x: 150, y: 150 });
    expect(within(objectRail()).getByText('inside group 3')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(within(objectRail()).getByText('inside group 4')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(within(objectRail()).queryByText(/^inside /)).toBeNull();
  });

  it('selecting a nested row in the rail steps in, and a top-level one steps out', async () => {
    const { user } = setup();
    await enteredTwo(user);

    await user.click(row('rect 1'));
    expect(within(objectRail()).getByText('inside group 3')).toBeInTheDocument();

    await user.click(row('group 3'));
    expect(within(objectRail()).queryByText('inside group 3')).toBeNull();
  });
});

describe('transforming a group as one unit', () => {
  it('dragging it moves every child, and one undo brings them all back', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    dragOn({ x: 150, y: 150 }, [{ x: 190, y: 170 }]);
    expect(groupTransforms()).toEqual(['translate(40 20)']);
    // The children's own coordinates are untouched: the group moved, they did
    // not, and the picture moved because the group is what holds them.
    expect(rectOrigins()).toEqual(['100,100', '300,300']);

    await user.keyboard('{Meta>}z{/Meta}');
    expect(groupTransforms()).toEqual(['']);
  });

  it('offers four corner handles and no edge ones, since a group has one scale', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    const resizes = handleNames().filter((name) => name.startsWith('Resize'));
    expect(resizes.sort()).toEqual(['Resize ne', 'Resize nw', 'Resize se', 'Resize sw']);
    expect(handleNames()).toContain('Rotate');
  });

  it('a selection of several still offers no handles — ⌘G is how you get them', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.keyboard('{Meta>}a{/Meta}');
    expect(handleNames().filter((name) => name.startsWith('Resize'))).toEqual([]);

    await user.keyboard('{Meta>}g{/Meta}');
    expect(handleNames().filter((name) => name.startsWith('Resize'))).not.toEqual([]);
  });

  it('the rotation knob turns the whole group about its own centre', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    const knob = within(screen.getByRole('main')).getByRole('button', { name: 'Rotate' });
    fireEvent.pointerDown(knob, client({ x: 250, y: 250 }));
    // Straight out to the right of the group's centre is a quarter turn.
    fireEvent.pointerMove(artboard(), client({ x: 600, y: 250 }));
    fireEvent.pointerUp(artboard(), client({ x: 600, y: 250 }));

    expect(groupTransforms()).toEqual(['translate(500 0) rotate(90)']);
    expect(rectOrigins()).toEqual(['100,100', '300,300']);
  });

  it('a corner handle scales it, and both axes together', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    const corner = within(screen.getByRole('main')).getByRole('button', { name: 'Resize se' });
    fireEvent.pointerDown(corner, client({ x: 400, y: 400 }));
    fireEvent.pointerMove(artboard(), client({ x: 700, y: 500 }));
    fireEvent.pointerUp(artboard(), client({ x: 700, y: 500 }));

    // The group's box was 100,100 to 400,400. Dragging its SE corner to 700,500
    // asks for a 600 × 400 box; one scale cannot be both, and the drag stays
    // proportional rather than stretching what is inside.
    expect(within(propsRail()).getByLabelText('Scale')).toHaveValue('200');
    expect(rectOrigins()).toEqual(['100,100', '300,300']);
  });

  it('a shape inside a moved group is still dragged by its own handles', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);
    dragOn({ x: 150, y: 150 }, [{ x: 190, y: 150 }]);
    expect(groupTransforms()).toEqual(['translate(40 0)']);

    // Step in, take hold of the child where it is actually drawn, and move it.
    doubleClickOn({ x: 190, y: 150 });
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'true');
    dragOn({ x: 190, y: 150 }, [{ x: 210, y: 160 }]);
    // Its own coordinates changed by the delta, not by the delta plus the
    // group's own offset — the group's frame is read, not ignored.
    expect(rectOrigins()).toEqual(['120,110', '300,300']);
  });

  it('the rail edits its placement rather than any child’s position', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    await setField(user, 'X', '25');
    expect(groupTransforms()).toEqual(['translate(25 0)']);
    expect(rectOrigins()).toEqual(['100,100', '300,300']);
  });

  it('offers one scale field rather than a width and a height', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    expect(within(propsRail()).getByLabelText('Scale')).toHaveValue('100');
    expect(within(propsRail()).queryByLabelText('Width')).not.toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('Height')).not.toBeInTheDocument();

    await setField(user, 'Scale', '200');
    expect(groupTransforms()).toEqual(['translate(-250 -250) scale(2)']);
  });
});

describe('hidden and locked reach down', () => {
  it('a hidden group hides its children', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    await user.click(within(objectRail()).getByRole('button', { name: 'Hide group 3' }));
    expect(rectOrigins()).toEqual([]);
    // The children still say they are visible themselves; it is the group above
    // them that is not drawn.
    expect(within(objectRail()).getByRole('button', { name: 'Hide rect 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('a locked group’s children do not move', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);
    await user.click(within(objectRail()).getByRole('button', { name: 'Lock group 3' }));

    // Dragging the group itself, and then a child from inside it.
    dragOn({ x: 150, y: 150 }, [{ x: 250, y: 250 }]);
    doubleClickOn({ x: 150, y: 150 });
    dragOn({ x: 150, y: 150 }, [{ x: 250, y: 250 }]);

    expect(groupTransforms()).toEqual(['']);
    expect(rectOrigins()).toEqual(['100,100', '300,300']);
  });
});

describe('the rail as a tree', () => {
  it('indents each level and collapses a group', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);
    expect(rowLevels()).toEqual(['1:group 3', '2:rect 2', '2:rect 1']);

    await user.click(within(objectRail()).getByRole('button', { name: 'Collapse group 3' }));
    expect(rowLevels()).toEqual(['1:group 3']);
    expect(maybeRow('rect 1')).toBeNull();

    await user.click(within(objectRail()).getByRole('button', { name: 'Expand group 3' }));
    expect(rowLevels()).toEqual(['1:group 3', '2:rect 2', '2:rect 1']);
  });

  it('⌥+arrow still reorders, and reorders within the group only', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);

    row('rect 2').focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(rowLevels()).toEqual(['1:group 3', '2:rect 1', '2:rect 2']);
    expect(screen.getByText('rect 2 moved down, now 2 of 2')).toBeInTheDocument();

    // The back of the group is a dead end: the row does not fall out into the
    // document's own list.
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(rowLevels()).toEqual(['1:group 3', '2:rect 1', '2:rect 2']);
  });

  it('names the level you are standing in, and offers the way out', async () => {
    const { user } = setup();
    await twoRects(user);
    await groupBoth(user);
    doubleClickOn({ x: 150, y: 150 });

    expect(within(objectRail()).getByText('inside group 3')).toBeInTheDocument();
    await user.click(within(objectRail()).getByRole('button', { name: 'Leave group 3' }));
    expect(within(objectRail()).queryByText('inside group 3')).toBeNull();
  });
});

describe('a document with no groups in it', () => {
  it('reads exactly as it did — one level, no `<g>`, and nothing to leave', async () => {
    const { user } = setup();
    await twoRects(user);

    expect(rowLevels()).toEqual(['1:rect 2', '1:rect 1']);
    expect(artboard().querySelectorAll('g')).toHaveLength(0);
    expect(within(objectRail()).queryByText(/^inside /)).toBeNull();

    // Escape still means "clear the selection" when there is no level to leave.
    await user.click(row('rect 1'));
    await user.keyboard('{Escape}');
    expect(row('rect 1')).toHaveAttribute('aria-pressed', 'false');
  });

  it('still resizes and rotates a lone shape by all eight handles', async () => {
    const { user } = setup();
    await twoRects(user);
    await user.click(row('rect 1'));
    const resizes = handleNames().filter((name) => name.startsWith('Resize'));
    expect(resizes).toHaveLength(8);
  });
});
