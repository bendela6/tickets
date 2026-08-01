import { cleanup, render, screen, within } from '@testing-library/react';
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

  it('offers the four shapes on the artboard until the first one exists', async () => {
    const { user } = setup();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('button', { name: 'Rectangle' })).toBeInTheDocument();
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
  it('R, E, L and P each add their shape', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('e');
    await user.keyboard('l');
    await user.keyboard('p');
    expect(within(objectRail()).getAllByRole('listitem')).toHaveLength(4);
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

  it('shows corner radius for a rectangle and sides for a polygon, never both', async () => {
    const { user } = setup();
    await user.keyboard('r');
    expect(within(propsRail()).getByLabelText('CORNER RADIUS')).toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('SIDES')).not.toBeInTheDocument();
    await user.keyboard('p');
    expect(within(propsRail()).getByLabelText('SIDES')).toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('CORNER RADIUS')).not.toBeInTheDocument();
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

  it('a line still rotates, because rotation is a transform and spins needs it', async () => {
    const { user } = setup();
    await user.keyboard('l');
    expect(handleNames()).toContain('Rotate');
  });
});

describe('every shape has equivalent controls', () => {
  const kinds = [
    { key: 'r', name: 'rect 1' },
    { key: 'e', name: 'ellipse 1' },
    { key: 'l', name: 'line 1' },
    { key: 'p', name: 'polygon 1' },
  ];

  it('all four can be given a stroke colour, not only a stroke width', async () => {
    for (const kind of kinds) {
      const { user } = setup();
      await user.keyboard(kind.key);
      expect(within(propsRail()).getByLabelText('STROKE light value')).toBeInTheDocument();
      cleanup();
    }
  });

  it('all four carry rotation, opacity and a thickness field', async () => {
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
    const { user } = setup();
    await user.keyboard('r');
    expect(within(propsRail()).getByLabelText('FILL light value')).toBeInTheDocument();
    await user.keyboard('l');
    expect(within(propsRail()).queryByLabelText('FILL light value')).not.toBeInTheDocument();
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

  it('a polygon is stated as a centre and a radius', async () => {
    const { user } = setup();
    await user.keyboard('p');
    const rail = propsRail();
    expect(within(rail).getByLabelText('Centre X')).toBeInTheDocument();
    expect(within(rail).getByLabelText('RADIUS')).toBeInTheDocument();
    expect(within(rail).getByLabelText('SIDES')).toBeInTheDocument();
    expect(within(rail).queryByLabelText('Width')).not.toBeInTheDocument();
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

  it('editing a polygon radius resizes it about its centre', async () => {
    const { user } = setup();
    await user.keyboard('p');
    const radius = within(propsRail()).getByLabelText('RADIUS');
    await user.clear(radius);
    await user.type(radius, '60');
    await user.tab();
    expect(within(propsRail()).getByLabelText('Centre X')).toHaveValue('256');
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

describe('motion', () => {
  it('is a property of the object, with three controls and no more', async () => {
    const { user } = setup();
    await user.keyboard('r');
    const rail = propsRail();
    expect(within(rail).getByRole('switch')).toBeChecked();
    expect(within(rail).getByRole('group', { name: 'Motion role' })).toBeInTheDocument();
    expect(within(rail).getByRole('group', { name: 'Pace' })).toBeInTheDocument();
    expect(within(rail).getByText('the only object in the animation')).toBeInTheDocument();
  });

  it('says what an object that takes no part does, rather than vanishing', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.click(within(propsRail()).getByRole('switch'));
    expect(within(propsRail()).getByText(/Does not take part/)).toBeInTheDocument();
    expect(within(propsRail()).queryByRole('group', { name: 'Pace' })).not.toBeInTheDocument();
  });

  it('names who leads and who follows once there is an order to name', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('e');
    // The ellipse is selected; both are at 1×, so document order decides.
    await user.click(within(propsRail()).getByRole('button', { name: '2×' }));
    expect(within(propsRail()).getByText(/leads/)).toBeInTheDocument();
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
