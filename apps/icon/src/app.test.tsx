import { render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText('125%')).toBeInTheDocument();
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
