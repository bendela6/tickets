import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './app';

const setup = () => {
  const user = userEvent.setup();
  render(<App />);
  return { user };
};

const objectRail = () => screen.getByRole('complementary', { name: 'Objects' });
const propsRail = () => screen.getByRole('complementary', { name: 'Properties' });

describe('the screen', () => {
  it('mounts the regions the design fixes in place', () => {
    setup();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(objectRail()).toBeInTheDocument();
    expect(propsRail()).toBeInTheDocument();
  });

  it('starts empty, and says so in both rails', () => {
    setup();
    expect(within(objectRail()).getByText('— no objects —')).toBeInTheDocument();
    expect(within(propsRail()).getByText('The artboard is empty.')).toBeInTheDocument();
  });

  it('offers every shape on the artboard until the first one exists', async () => {
    const { user } = setup();
    const main = screen.getByRole('main');
    for (const name of ['Rectangle', 'Circle', 'Ellipse', 'Line', 'Polyline', 'Polygon', 'Arc']) {
      expect(within(main).getByRole('button', { name })).toBeInTheDocument();
    }
    await user.click(within(main).getByRole('button', { name: 'Rectangle' }));
    expect(within(main).queryByText('place your first shape')).not.toBeInTheDocument();
  });
});

describe('adding and selecting', () => {
  it('adds a shape, lists it, and selects it', async () => {
    const { user } = setup();
    await user.click(within(objectRail()).getByRole('button', { name: 'Ellipse' }));
    expect(within(objectRail()).getByRole('button', { name: 'ellipse 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Selection reads in the right rail too.
    expect(within(propsRail()).getByText('ELLIPSE')).toBeInTheDocument();
  });

  it('adds every kind from its own button, and selects what it added', async () => {
    const tools = [
      { label: 'Rectangle', name: 'rect 1', kind: 'RECT' },
      { label: 'Circle', name: 'circle 1', kind: 'CIRCLE' },
      { label: 'Ellipse', name: 'ellipse 1', kind: 'ELLIPSE' },
      { label: 'Line', name: 'line 1', kind: 'LINE' },
      { label: 'Polyline', name: 'polyline 1', kind: 'POLYLINE' },
      { label: 'Polygon', name: 'polygon 1', kind: 'POLYGON' },
      { label: 'Arc', name: 'path 1', kind: 'PATH' },
    ];
    for (const tool of tools) {
      const { user } = setup();
      await user.click(within(objectRail()).getByRole('button', { name: tool.label }));
      expect(within(objectRail()).getByRole('button', { name: tool.name })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      // Selection reads in the right rail too, which names the kind.
      expect(within(propsRail()).getByText(tool.kind)).toBeInTheDocument();
      cleanup();
    }
  });

  it('puts each new shape in front of the last', async () => {
    const { user } = setup();
    await user.click(within(objectRail()).getByRole('button', { name: 'Rectangle' }));
    await user.click(within(objectRail()).getByRole('button', { name: 'Line' }));
    const rows = within(objectRail()).getAllByRole('listitem');
    // Numbering is global rather than per-kind, so a name is never reused
    // after a deletion: the second shape is `line 2`, not `line 1`.
    expect(rows[0]).toHaveTextContent('line 2');
    expect(rows[1]).toHaveTextContent('rect 1');
  });

  it('the properties rail falls back to the document rather than emptying', async () => {
    const { user } = setup();
    await user.click(within(objectRail()).getByRole('button', { name: 'Rectangle' }));
    expect(within(propsRail()).getByText('RECT')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(within(propsRail()).getByText('DOCUMENT')).toBeInTheDocument();
    expect(within(propsRail()).getByText('1 object on the artboard.')).toBeInTheDocument();
  });
});

describe('keyboard', () => {
  it('R, C, E, L, Y, P and A each add their shape', async () => {
    const { user } = setup();
    for (const key of ['r', 'c', 'e', 'l', 'y', 'p', 'a']) {
      await user.keyboard(key);
    }
    const rows = within(objectRail()).getAllByRole('listitem');
    expect(rows).toHaveLength(7);
    // Front-to-back, so the last one pressed reads first.
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('path 7'),
      expect.stringContaining('polygon 6'),
      expect.stringContaining('polyline 5'),
      expect.stringContaining('line 4'),
      expect.stringContaining('ellipse 3'),
      expect.stringContaining('circle 2'),
      expect.stringContaining('rect 1'),
    ]);
  });

  it('does not add a shape while a field has focus', async () => {
    const { user } = setup();
    await user.keyboard('r');
    const x = within(propsRail()).getByLabelText('X');
    await user.click(x);
    await user.keyboard('e');
    // Still one object: the `e` went into the field, not to the artboard.
    expect(within(objectRail()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('Backspace deletes the selection, and ⌘Z brings it back', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('{Backspace}');
    expect(within(objectRail()).getByText('— no objects —')).toBeInTheDocument();
    await user.keyboard('{Meta>}z{/Meta}');
    expect(within(objectRail()).queryByText('— no objects —')).not.toBeInTheDocument();
  });

  it('echoes what undo did in the status line, then falls back', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('{Meta>}z{/Meta}');
    expect(screen.getByRole('status')).toHaveTextContent('undid · add rect');
  });

  it('⇧⌘Z redoes', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('{Meta>}z{/Meta}');
    await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(within(objectRail()).getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('visibility and locking', () => {
  it('hides and shows an object from its row', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.click(within(objectRail()).getByRole('button', { name: 'Hide rect 1' }));
    expect(within(objectRail()).getByRole('button', { name: 'Show rect 1' })).toBeInTheDocument();
  });

  it('locks and unlocks an object from its row', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.click(within(objectRail()).getByRole('button', { name: 'Lock rect 1' }));
    expect(within(objectRail()).getByRole('button', { name: 'Unlock rect 1' })).toBeInTheDocument();
  });
});

describe('properties', () => {
  it('reports the selected object’s box and moves it when the box is edited', async () => {
    const { user } = setup();
    await user.keyboard('r');
    const x = within(propsRail()).getByLabelText('X');
    expect(x).toHaveValue('136');
    await user.clear(x);
    await user.type(x, '200');
    await user.tab();
    expect(within(propsRail()).getByLabelText('X')).toHaveValue('200');
  });

  it('shows corner radius for a rectangle and for nothing else', async () => {
    // A polygon used to offer a side count beside it. It is a list of points
    // now, and a count cannot describe one — so the rectangle is the only
    // shape left with a property of its own.
    const { user } = setup();
    await user.keyboard('r');
    expect(within(propsRail()).getByLabelText('CORNER RADIUS')).toBeInTheDocument();
    for (const key of ['c', 'e', 'l', 'y', 'p', 'a']) {
      await user.keyboard(key);
      expect(within(propsRail()).queryByLabelText('CORNER RADIUS')).not.toBeInTheDocument();
    }
  });

  it('offers opacity as a slider as well as a number', async () => {
    const { user } = setup();
    await user.keyboard('r');
    const slider = within(propsRail()).getByRole('slider', { name: 'rect 1 opacity' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    slider.focus();
    await user.keyboard('{ArrowLeft}');
    expect(within(propsRail()).getByLabelText('OPACITY')).toHaveValue('99');
  });
});

describe('selection follows the object it is selecting', () => {
  const overlay = () =>
    screen.getByRole('main').querySelector<HTMLElement>('.outline-handle');

  it('turns with the object rather than boxing it upright', async () => {
    const { user } = setup();
    await user.keyboard('r');
    expect(overlay()?.style.transform).toBe('rotate(0deg)');

    const rotation = within(propsRail()).getByLabelText('ROTATION');
    await user.clear(rotation);
    await user.type(rotation, '45');
    await user.tab();

    expect(overlay()?.style.transform).toBe('rotate(45deg)');
  });
});

describe('handles match the shape', () => {
  const handleNames = () =>
    within(screen.getByRole('main'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((label): label is string => label !== null);

  it('a box shape gets eight resize handles and a rotate knob', async () => {
    const { user } = setup();
    await user.keyboard('r');
    const names = handleNames();
    for (const handle of ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e']) {
      expect(names).toContain(`Resize ${handle}`);
    }
    expect(names).toContain('Rotate');
  });

  it('a line gets its two ends instead — it cannot be resized as a box', async () => {
    const { user } = setup();
    await user.keyboard('l');
    const names = handleNames();
    expect(names).toContain('Move start point');
    expect(names).toContain('Move end point');
    expect(names.filter((name) => name.startsWith('Resize'))).toEqual([]);
  });

  it('a circle is resized as a box, since a box is what keeps it round', async () => {
    const { user } = setup();
    await user.keyboard('c');
    expect(handleNames()).toContain('Resize se');
  });

  it('a polygon gets one handle per point and no box handles at all', async () => {
    const { user } = setup();
    await user.keyboard('p');
    const names = handleNames();
    // The hexagon preset: six points, so six handles.
    for (let i = 1; i <= 6; i++) expect(names).toContain(`Move point ${i}`);
    expect(names).not.toContain('Move point 7');
    expect(names.filter((name) => name.startsWith('Resize'))).toEqual([]);
  });

  it('a path gets a handle at each of its nodes, the way a point list does', async () => {
    const { user } = setup();
    await user.keyboard('a');
    const names = handleNames();
    // The spinner preset is a move and one arc, so it has two anchors — and a
    // two-point run's ends are a start and an end, whatever kind draws them.
    expect(names).toContain('Move start point');
    expect(names).toContain('Move end point');
    // Like any other shape carried by its points, no box handles at all.
    expect(names.filter((name) => name.startsWith('Resize'))).toEqual([]);
    expect(names).toContain('Rotate');
  });

  it('a polyline gets one handle per point too', async () => {
    const { user } = setup();
    await user.keyboard('y');
    const names = handleNames();
    expect(names.filter((name) => name.startsWith('Move point'))).toEqual([
      'Move point 1',
      'Move point 2',
      'Move point 3',
    ]);
  });

  it('every shape still rotates, because rotation is a transform and spins needs it', async () => {
    for (const key of ['r', 'c', 'e', 'l', 'y', 'p', 'a']) {
      const { user } = setup();
      await user.keyboard(key);
      expect(handleNames()).toContain('Rotate');
      cleanup();
    }
  });
});

describe('editing the nodes of a shape', () => {
  const handleNames = () =>
    within(screen.getByRole('main'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((label): label is string => label !== null);

  const nodeCount = () => handleNames().filter((name) => name.startsWith('Move point')).length;

  const handle = (name: string) =>
    within(screen.getByRole('main')).getByRole('button', { name });

  const node = (index: number) => handle(`Move point ${index}`);

  /**
   * Press a handle and let go.
   *
   * The release goes to the artboard rather than to the handle, because handles
   * are withdrawn for the duration of a drag — so by the time the pointer comes
   * up, the button it went down on is not there any more, and the artboard
   * underneath is what actually receives it.
   */
  const press = (target: HTMLElement) => {
    fireEvent.pointerDown(target);
    fireEvent.pointerUp(screen.getByRole('img'));
  };

  /**
   * Document units to CSS pixels at the default zoom. The artboard has no
   * layout in a test environment, so its own rectangle reads as the origin and
   * a client coordinate is simply the document one scaled.
   */
  const SCALE = 448 / 512;

  const doubleClickAt = (at: { x: number; y: number }) =>
    fireEvent.doubleClick(screen.getByRole('img'), {
      clientX: at.x * SCALE,
      clientY: at.y * SCALE,
    });

  it('selects the node that was pressed, and only that one', async () => {
    const { user } = setup();
    await user.keyboard('p');
    press(node(3));
    expect(node(3)).toHaveAttribute('aria-pressed', 'true');
    expect(node(1)).toHaveAttribute('aria-pressed', 'false');
  });

  it('Backspace removes the selected node instead of the object', async () => {
    const { user } = setup();
    await user.keyboard('p');
    expect(nodeCount()).toBe(6);
    press(node(2));
    await user.keyboard('{Backspace}');
    expect(nodeCount()).toBe(5);
    // The object is still there — the key took a point, not the shape.
    expect(within(objectRail()).getByRole('button', { name: 'polygon 1' })).toBeInTheDocument();
  });

  it('Backspace goes back to meaning the object once no node is selected', async () => {
    const { user } = setup();
    await user.keyboard('p');
    press(node(2));
    // Removing a node clears the node selection, so the next press is the
    // object's again. The precedence is a state, not a mode you get stuck in.
    await user.keyboard('{Backspace}');
    await user.keyboard('{Backspace}');
    expect(within(objectRail()).getByText('— no objects —')).toBeInTheDocument();
  });

  it('Backspace at the floor does nothing at all, and above all does not delete the shape', async () => {
    const { user } = setup();
    await user.keyboard('l');
    // A line is two points by definition, so its ends can never be removed.
    press(handle('Move end point'));
    await user.keyboard('{Backspace}');
    expect(within(objectRail()).getByRole('button', { name: 'line 1' })).toBeInTheDocument();
    expect(handle('Move end point')).toBeInTheDocument();
  });

  it('double-clicking an outline adds a node there and selects it', async () => {
    const { user } = setup();
    await user.keyboard('p');
    // A shade inside the edge running from the hexagon's first point (256,136)
    // to its second (360,196) — its midpoint, nudged towards the centre.
    doubleClickAt({ x: 307, y: 167 });
    expect(nodeCount()).toBe(7);
    // It goes between the two neighbours it was dropped between, and it is what
    // the next Backspace would take.
    expect(node(2)).toHaveAttribute('aria-pressed', 'true');
  });

  it('double-clicking away from any outline adds nothing', async () => {
    const { user } = setup();
    await user.keyboard('p');
    // Dead centre of the hexagon: on the object, nowhere near its outline.
    doubleClickAt({ x: 256, y: 256 });
    expect(nodeCount()).toBe(6);
  });

  it('adding a node is one step, so undo takes it straight back out', async () => {
    const { user } = setup();
    await user.keyboard('p');
    doubleClickAt({ x: 307, y: 167 });
    expect(nodeCount()).toBe(7);
    await user.keyboard('{Meta>}z{/Meta}');
    expect(nodeCount()).toBe(6);
  });
});

describe('every shape has equivalent controls', () => {
  const kinds = [
    { key: 'r', name: 'rect 1' },
    { key: 'c', name: 'circle 1' },
    { key: 'e', name: 'ellipse 1' },
    { key: 'l', name: 'line 1' },
    { key: 'y', name: 'polyline 1' },
    { key: 'p', name: 'polygon 1' },
    { key: 'a', name: 'path 1' },
  ];

  it('all of them can be given a stroke colour, not only a stroke width', async () => {
    for (const kind of kinds) {
      const { user } = setup();
      await user.keyboard(kind.key);
      expect(within(propsRail()).getByLabelText('STROKE light value')).toBeInTheDocument();
      cleanup();
    }
  });

  it('all of them carry rotation, opacity and a thickness field', async () => {
    for (const kind of kinds) {
      const { user } = setup();
      await user.keyboard(kind.key);
      const rail = propsRail();
      expect(within(rail).getByLabelText('ROTATION')).toBeInTheDocument();
      expect(within(rail).getByLabelText('OPACITY')).toBeInTheDocument();
      expect(
        within(rail).queryByLabelText('Stroke width') ?? within(rail).getByLabelText('Thickness'),
      ).toBeInTheDocument();
      cleanup();
    }
  });

  it('only the shapes with an area offer a fill', async () => {
    for (const kind of kinds) {
      const { user } = setup();
      await user.keyboard(kind.key);
      const filled = within(propsRail()).queryByLabelText('FILL light value') !== null;
      // The arc preset is an open path, so it is a run for exactly the reason
      // a line is: there is no area under it to fill.
      const isRun = ['line', 'polyline', 'path'].some((prefix) => kind.name.startsWith(prefix));
      expect({ name: kind.name, filled }).toEqual({ name: kind.name, filled: !isRun });
      cleanup();
    }
  });

  it('a line is stated as two points, never as a width and a height', async () => {
    const { user } = setup();
    await user.keyboard('l');
    const rail = propsRail();
    for (const label of ['X1', 'Y1', 'X2', 'Y2']) {
      expect(within(rail).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(rail).queryByLabelText('Width')).not.toBeInTheDocument();
    expect(within(rail).queryByLabelText('Height')).not.toBeInTheDocument();
  });

  it('a circle is stated as a centre and a radius, never as a width and a height', async () => {
    const { user } = setup();
    await user.keyboard('c');
    const rail = propsRail();
    expect(within(rail).getByLabelText('Centre X')).toBeInTheDocument();
    expect(within(rail).getByLabelText('RADIUS')).toBeInTheDocument();
    expect(within(rail).queryByLabelText('Width')).not.toBeInTheDocument();
  });

  it('a point list is stated as the box it occupies, plus how many points it has', async () => {
    const { user } = setup();
    await user.keyboard('p');
    const rail = propsRail();
    for (const label of ['X', 'Y', 'Width', 'Height']) {
      expect(within(rail).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(rail).getByText('POINTS')).toBeInTheDocument();
    // The hexagon preset. It is a readout, not a field — nothing types into it.
    expect(within(rail).getByText('6')).toBeInTheDocument();
    expect(within(rail).queryByLabelText('POINTS')).not.toBeInTheDocument();
  });

  it('a path is stated as the box it occupies, plus how many commands it holds', async () => {
    const { user } = setup();
    await user.keyboard('a');
    const rail = propsRail();
    for (const label of ['X', 'Y', 'Width', 'Height']) {
      expect(within(rail).getByLabelText(label)).toBeInTheDocument();
    }
    // The spinner preset: a move and a single arc. A readout, not a field —
    // nodes become editable in their own right later.
    expect(within(rail).getByText('SEGMENTS')).toBeInTheDocument();
    expect(within(rail).getByText('2')).toBeInTheDocument();
    expect(within(rail).queryByLabelText('SEGMENTS')).not.toBeInTheDocument();
  });

  it('editing a path’s width scales the curve, keeping the commands it had', async () => {
    const { user } = setup();
    await user.keyboard('a');
    const width = within(propsRail()).getByLabelText('Width');
    await user.clear(width);
    await user.type(width, '100');
    await user.tab();
    expect(within(propsRail()).getByLabelText('Width')).toHaveValue('100');
    expect(within(propsRail()).getByText('2')).toBeInTheDocument();
  });

  it('editing a line endpoint moves that end and leaves the other alone', async () => {
    const { user } = setup();
    await user.keyboard('l');
    const x1 = within(propsRail()).getByLabelText('X1');
    await user.clear(x1);
    await user.type(x1, '50');
    await user.tab();
    expect(within(propsRail()).getByLabelText('X1')).toHaveValue('50');
    expect(within(propsRail()).getByLabelText('X2')).toHaveValue('376');
  });

  it('editing a circle radius resizes it about its centre', async () => {
    const { user } = setup();
    await user.keyboard('c');
    const radius = within(propsRail()).getByLabelText('RADIUS');
    await user.clear(radius);
    await user.type(radius, '60');
    await user.tab();
    expect(within(propsRail()).getByLabelText('Centre X')).toHaveValue('256');
  });

  it('editing a point list’s width scales it, keeping every point it had', async () => {
    const { user } = setup();
    await user.keyboard('p');
    const rail = propsRail();
    const before = within(rail).getByLabelText('X').getAttribute('value');
    const width = within(rail).getByLabelText('Width');
    await user.clear(width);
    await user.type(width, '100');
    await user.tab();
    expect(within(propsRail()).getByLabelText('Width')).toHaveValue('100');
    // Scaled from its own left edge rather than recentred.
    expect(within(propsRail()).getByLabelText('X')).toHaveValue(before);
    expect(within(propsRail()).getByText('6')).toBeInTheDocument();
  });
});

describe('the artboard is configurable in both axes', () => {
  const docRail = () => {
    // Nothing selected: the right rail carries the document's properties.
    return propsRail();
  };

  it('offers width and height as separate fields', async () => {
    setup();
    expect(within(docRail()).getByLabelText('Artboard width')).toHaveValue('512');
    expect(within(docRail()).getByLabelText('Artboard height')).toHaveValue('512');
  });

  it('takes a non-square board, and the top bar reports both edges', async () => {
    const { user } = setup();
    const height = within(docRail()).getByLabelText('Artboard height');
    await user.clear(height);
    await user.type(height, '256');
    await user.tab();
    expect(within(screen.getByRole('banner')).getByText('512 × 256')).toBeInTheDocument();
  });

  it('takes a tiny board, which is the case the precision setting exists for', async () => {
    const { user } = setup();
    for (const label of ['Artboard width', 'Artboard height']) {
      const field = within(docRail()).getByLabelText(label);
      await user.clear(field);
      await user.type(field, '16');
      await user.tab();
    }
    expect(within(screen.getByRole('banner')).getByText('16 × 16')).toBeInTheDocument();
  });

  it('offers square presets beside the fields', async () => {
    const { user } = setup();
    await user.click(within(docRail()).getByRole('button', { name: '16 by 16' }));
    expect(within(screen.getByRole('banner')).getByText('16 × 16')).toBeInTheDocument();
  });
});

describe('precision', () => {
  const setStep = async (user: ReturnType<typeof userEvent.setup>, step: string) => {
    const field = within(propsRail()).getByLabelText('Snap step');
    await user.clear(field);
    await user.type(field, step);
    await user.tab();
  };

  it('is a document setting, offered with presets', async () => {
    setup();
    expect(within(propsRail()).getByLabelText('Snap step')).toHaveValue('1');
    expect(within(propsRail()).getByRole('button', { name: 'Step 8' })).toBeInTheDocument();
  });

  it('a step of 1 refuses a half — typing 1.5 lands on 2', async () => {
    const { user } = setup();
    await user.keyboard('r');
    const x = within(propsRail()).getByLabelText('X');
    await user.clear(x);
    await user.type(x, '1.5');
    await user.tab();
    expect(within(propsRail()).getByLabelText('X')).toHaveValue('2');
  });

  it('a finer step allows the half the coarser one refused', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('{Escape}');
    await setStep(user, '0.5');
    await user.click(within(objectRail()).getByRole('button', { name: 'rect 1' }));

    const x = within(propsRail()).getByLabelText('X');
    await user.clear(x);
    await user.type(x, '1.5');
    await user.tab();
    expect(within(propsRail()).getByLabelText('X')).toHaveValue('1.5');
  });

  it('a coarser step pulls existing work onto the new grid', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('{Escape}');
    await user.click(within(propsRail()).getByRole('button', { name: 'Step 8' }));
    await user.click(within(objectRail()).getByRole('button', { name: 'rect 1' }));
    expect(Number(within(propsRail()).getByLabelText('X').getAttribute('value')) % 8).toBe(0);
  });
});

describe('zoom', () => {
  const zoomLabel = () => screen.getByRole('button', { name: 'Reset zoom' });

  it('walks a ladder in both directions', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomLabel()).toHaveTextContent('150%');
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoomLabel()).toHaveTextContent('100%');
  });

  it('reaches far enough to draw on a tiny board and to see a huge one', async () => {
    const { user } = setup();
    for (let i = 0; i < 12; i++) {
      await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    }
    expect(zoomLabel()).toHaveTextContent('1600%');
    for (let i = 0; i < 20; i++) {
      await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    }
    expect(zoomLabel()).toHaveTextContent('10%');
  });

  it('resets to 100% from its own readout', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(zoomLabel());
    expect(zoomLabel()).toHaveTextContent('100%');
  });

  it('resets to 100% from the keyboard, which is what the readout promises', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomLabel()).toHaveTextContent('150%');
    await user.keyboard('{Control>}0{/Control}');
    expect(zoomLabel()).toHaveTextContent('100%');
  });

  it('leaves the zoom alone when there is no layout to fit it to', async () => {
    // ⇧⌘0 fits the board to the canvas, which needs a measured canvas: with
    // none it does nothing rather than jumping to some invented number.
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.keyboard('{Control>}{Shift>}0{/Shift}{/Control}');
    expect(zoomLabel()).toHaveTextContent('150%');
  });

  it('is a way of looking, not an edit — it never dirties the document', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(within(screen.getByRole('banner')).queryByText('unsaved')).not.toBeInTheDocument();
  });
});

describe('colour is a pair', () => {
  it('edits the previewed half and leaves the other alone', async () => {
    const { user } = setup();
    await user.keyboard('r');
    // Light is previewed by default, so the presets write the light half.
    await user.click(within(propsRail()).getByRole('button', { name: 'Set fill to #C0382E' }));
    expect(within(propsRail()).getByLabelText('FILL light value')).toHaveValue('#C0382E');

    await user.click(screen.getByRole('button', { name: 'dark' }));
    expect(within(propsRail()).getByLabelText('FILL dark value')).toHaveValue('#A9A2F2');
  });

  it('a line edits its stroke rather than a fill it cannot show', async () => {
    const { user } = setup();
    await user.keyboard('l');
    expect(within(propsRail()).getByLabelText('STROKE light value')).toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('FILL light value')).not.toBeInTheDocument();
  });

  it('rejects text that is not a colour and puts the old value back', async () => {
    const { user } = setup();
    await user.keyboard('r');
    const hex = within(propsRail()).getByLabelText('FILL light value');
    await user.clear(hex);
    await user.type(hex, 'not a colour');
    await user.tab();
    expect(within(propsRail()).getByLabelText('FILL light value')).toHaveValue('#4E46C6');
  });
});

describe('platform validation', () => {
  it('stays quiet until something actually reaches past the safe zone', async () => {
    const { user } = setup();
    await user.keyboard('r');
    expect(screen.queryByRole('button', { name: /platform warning/ })).not.toBeInTheDocument();

    const w = within(propsRail()).getByLabelText('Width');
    await user.clear(w);
    await user.type(w, '500');
    await user.tab();
    expect(screen.getByRole('button', { name: /1 platform warning/ })).toBeInTheDocument();
  });
});

describe('looking at the document', () => {
  it('zooms in steps, without touching the document', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    // The ladder runs 100 → 150, not 100 → 125: a fixed percentage step is
    // the wrong shape for a range that now spans 10% to 1600%.
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toHaveTextContent('150%');
  });

  it('previews the other ground without changing the UI theme', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.click(screen.getByRole('button', { name: 'dark' }));
    expect(within(propsRail()).getByLabelText('FILL dark value')).toBeInTheDocument();
    expect(document.documentElement.dataset['theme']).not.toBe('dark');
  });

  it('toggles the grid', async () => {
    const { user } = setup();
    const grid = screen.getByRole('button', { name: 'grid' });
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    await user.click(grid);
    expect(screen.getByRole('button', { name: 'grid' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the pen', () => {
  const artboard = () => screen.getByRole('img');

  const handleNames = () =>
    within(screen.getByRole('main'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((label): label is string => label !== null);

  const penButton = () => within(objectRail()).getByRole('button', { name: 'Pen' });

  /**
   * Document units to CSS pixels at the default zoom. The artboard has no
   * layout in a test environment, so its own rectangle reads as the origin and
   * a client coordinate is simply the document one scaled.
   */
  const SCALE = 448 / 512;

  const client = (at: { x: number; y: number }) => ({
    button: 0,
    clientX: at.x * SCALE,
    clientY: at.y * SCALE,
  });

  /** A press and a release in the same place: one corner anchor. */
  const clickAt = (at: { x: number; y: number }) => {
    fireEvent.pointerDown(artboard(), client(at));
    fireEvent.pointerUp(artboard(), client(at));
  };

  /** A press that travels before it lets go: one smooth anchor at `at`. */
  const dragAt = (at: { x: number; y: number }, to: { x: number; y: number }) => {
    fireEvent.pointerDown(artboard(), client(at));
    fireEvent.pointerMove(artboard(), client(to));
    fireEvent.pointerUp(artboard(), client(to));
  };

  /**
   * The commands of the one path in the document, read back through the same
   * renderer the export uses — which is the document itself, spelled the way
   * SVG spells it.
   */
  const drawnPath = () => artboard().querySelector('svg path')?.getAttribute('d');

  it('is entered from its toolbar button and from its key, and says which it is in', async () => {
    const { user } = setup();
    expect(penButton()).toHaveAttribute('aria-pressed', 'false');

    await user.click(penButton());
    expect(penButton()).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(penButton()).toHaveAttribute('aria-pressed', 'false');

    await user.keyboard('n');
    expect(penButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('three clicks and Enter draw three anchors joined by straight commands', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 100 });
    clickAt({ x: 300, y: 100 });
    clickAt({ x: 300, y: 300 });
    await user.keyboard('{Enter}');

    expect(drawnPath()).toBe('M 100 100 L 300 100 L 300 300');
    expect(within(objectRail()).getByRole('button', { name: 'path 1' })).toBeInTheDocument();
    // And it is a path like any other from here on: one node handle per anchor.
    expect(handleNames().filter((name) => name.startsWith('Move point'))).toEqual([
      'Move point 1',
      'Move point 2',
      'Move point 3',
    ]);
    // The tool is done, not still waiting for a fourth anchor.
    expect(penButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('a press that drags pulls a curve out of the anchor, mirrored either side of it', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 300 });
    dragAt({ x: 200, y: 200 }, { x: 240, y: 200 });
    clickAt({ x: 300, y: 300 });
    await user.keyboard('{Enter}');

    // 160 and 240 sit the same 40 units either side of the anchor at 200: the
    // curve arrives and leaves along one straight line through it, which is
    // what makes it smooth rather than kinked.
    expect(drawnPath()).toBe('M 100 300 C 100 300 160 200 200 200 C 240 200 300 300 300 300');
  });

  it('a click on the first anchor closes the path and ends the tool', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 100 });
    clickAt({ x: 300, y: 100 });
    clickAt({ x: 200, y: 300 });
    clickAt({ x: 100, y: 100 });

    expect(drawnPath()).toBe('M 100 100 L 300 100 L 200 300 Z');
    expect(penButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('a double-click ends the path where it was double-clicked', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 100 });
    clickAt({ x: 300, y: 100 });
    // The real sequence a double-click arrives as: two presses, each of which
    // has already placed an anchor, and then the double-click itself.
    clickAt({ x: 300, y: 300 });
    clickAt({ x: 300, y: 300 });
    fireEvent.doubleClick(artboard(), client({ x: 300, y: 300 }));

    expect(drawnPath()).toBe('M 100 100 L 300 100 L 300 300');
  });

  it('Escape discards a single anchor rather than leaving a shape that draws nothing', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 100 });
    await user.keyboard('{Escape}');

    expect(within(objectRail()).getByText('— no objects —')).toBeInTheDocument();
  });

  it('Escape keeps three, because three anchors are a shape', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 100 });
    clickAt({ x: 300, y: 100 });
    clickAt({ x: 300, y: 300 });
    await user.keyboard('{Escape}');

    expect(within(objectRail()).getByRole('button', { name: 'path 1' })).toBeInTheDocument();
    expect(drawnPath()).toBe('M 100 100 L 300 100 L 300 300');
  });

  it('Backspace takes back the last anchor placed', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 100 });
    clickAt({ x: 300, y: 100 });
    clickAt({ x: 300, y: 300 });
    await user.keyboard('{Backspace}');
    await user.keyboard('{Enter}');

    expect(drawnPath()).toBe('M 100 100 L 300 100');
  });

  it('the whole drawing is one undo entry, however many anchors it took', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 100 });
    clickAt({ x: 200, y: 100 });
    clickAt({ x: 300, y: 200 });
    clickAt({ x: 300, y: 300 });
    await user.keyboard('{Enter}');
    expect(within(objectRail()).getAllByRole('listitem')).toHaveLength(1);

    await user.keyboard('{Meta>}z{/Meta}');
    // The whole path, not its last anchor.
    expect(within(objectRail()).getByText('— no objects —')).toBeInTheDocument();
  });

  it('entering and leaving leaves the selection exactly as it found it', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('n');
    await user.keyboard('{Escape}');

    expect(within(objectRail()).getByRole('button', { name: 'rect 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(propsRail()).getByText('RECT')).toBeInTheDocument();
  });

  it('withdraws the selection handles while it is active, and gives them straight back', async () => {
    const { user } = setup();
    await user.keyboard('r');
    expect(handleNames()).toContain('Resize se');

    // Handles are buttons sitting over the artboard; any one of them would
    // swallow a click meant for an anchor.
    await user.keyboard('n');
    expect(handleNames()).not.toContain('Resize se');

    await user.keyboard('{Escape}');
    expect(handleNames()).toContain('Resize se');
  });

  it('a press on an existing shape neither selects it nor moves it', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('{Escape}');
    await user.keyboard('n');

    // Dead centre of the rectangle, dragged well clear of it — which with the
    // pen active is one anchor and its handle, and nothing to do with the rect.
    dragAt({ x: 256, y: 256 }, { x: 400, y: 400 });
    expect(within(objectRail()).getByRole('button', { name: 'rect 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.keyboard('{Escape}');
    await user.click(within(objectRail()).getByRole('button', { name: 'rect 1' }));
    expect(within(propsRail()).getByLabelText('X')).toHaveValue('136');
  });

  it('does not take a shape key while a path is being drawn', async () => {
    const { user } = setup();
    await user.keyboard('n');
    clickAt({ x: 100, y: 100 });
    clickAt({ x: 300, y: 100 });
    // A rectangle here would land behind the path and be selected by the time
    // the pen finished and took the selection back.
    await user.keyboard('r');
    await user.keyboard('{Enter}');

    expect(within(objectRail()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(objectRail()).getByRole('button', { name: 'path 1' })).toBeInTheDocument();
  });
});
