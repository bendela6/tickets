import { render, screen, within } from '@testing-library/react';
import { TONE_NAMES } from '../style';
import {
  Center,
  defineState,
  Grid,
  isDefinedState,
  isToneSet,
  List,
  Matrix,
  Slot,
  TONE_SETS,
  Wrap,
} from './states';

describe('TONE_SETS', () => {
  it('splits the vocabulary in two with nothing lost or counted twice', () => {
    // Roles and palette are generated from the token source, so a tone added
    // to either half must show up in exactly one of them — otherwise the
    // switch quietly hides a tone that nobody can find any other way.
    expect([...TONE_SETS.roles, ...TONE_SETS.palette]).toEqual([...TONE_NAMES]);
    expect(TONE_SETS.all).toEqual(TONE_NAMES);
  });

  it('rejects a set name it does not know', () => {
    // Storage can hand back a value left by an older build.
    expect(isToneSet('roles')).toBe(true);
    expect(isToneSet('semantic')).toBe(false);
    expect(isToneSet(undefined)).toBe(false);
  });
});

describe('defineState', () => {
  it('brands a section so the collector can tell it from a plain literal', () => {
    expect(isDefinedState(defineState({ title: 'a', render: () => null }))).toBe(true);
    expect(isDefinedState({ name: 'a', render: () => null })).toBe(false);
    expect(isDefinedState(null)).toBe(false);
  });
});

describe('Slot', () => {
  it('takes its width from the surrounding layout, not a prop', () => {
    // The same slot is a cell in a Wrap and a full-width band in a List, which
    // is why the four layouts are components rather than class strings.
    const { container: inline } = render(
      <Wrap>
        <Slot label="a">x</Slot>
      </Wrap>,
    );
    const { container: block } = render(
      <List>
        <Slot label="a">x</Slot>
      </List>,
    );
    expect(inline.querySelector('figure')!.className).not.toContain('w-full');
    expect(block.querySelector('figure')!.className).toContain('w-full');
  });

  it('omits the caption when there is no label', () => {
    const { container } = render(
      <Wrap>
        <Slot>x</Slot>
      </Wrap>,
    );
    expect(container.querySelector('figcaption')).toBeNull();
  });
});

describe('layouts', () => {
  it.each([
    ['Wrap', Wrap, 'flex-wrap'],
    ['List', List, 'flex-col'],
    ['Center', Center, 'justify-center'],
  ])('%s arranges its children', (_name, Component, expected) => {
    const { container } = render(<Component>x</Component>);
    expect(container.firstElementChild!.className).toContain(expected);
  });

  it('names its grid columns literally, so Tailwind can scan them', () => {
    // `grid-cols-${n}` compiles to nothing and fails silently — every grid
    // would render as a single column with no error anywhere.
    const { container } = render(<Grid columns={6}>x</Grid>);
    expect(container.firstElementChild!.className).toContain('grid-cols-6');
  });
});

describe('Matrix', () => {
  const VARIANTS = ['subtle', 'solid'] as const;
  const TONES = ['primary', 'danger', 'neutral'] as const;

  function renderMatrix() {
    return render(
      <Matrix
        rows={TONES}
        columns={VARIANTS}
        cell={(tone, variant) => <button>{`${variant}/${tone}`}</button>}
      />,
    );
  }

  it('renders every intersection of the two axes', () => {
    renderMatrix();
    for (const variant of VARIANTS) {
      for (const tone of TONES) {
        expect(screen.getByRole('button', { name: `${variant}/${tone}` })).toBeTruthy();
      }
    }
    expect(screen.getAllByRole('cell')).toHaveLength(VARIANTS.length * TONES.length);
  });

  it('labels both axes as real table headers', () => {
    // The content is labelled on two axes, so scope says which is which rather
    // than leaving a screen reader to infer it from a grid of divs.
    renderMatrix();
    const cols = screen.getAllByRole('columnheader');
    // The corner spans neither axis and carries no name.
    expect(cols.map((h) => h.textContent)).toEqual(['', 'subtle', 'solid']);
    expect(cols[1]!.getAttribute('scope')).toBe('col');
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual([...TONES]);
  });

  it('sticks both header bands so they survive the card scrolling', () => {
    // A tone axis is seventeen rows deep inside a panel that stops at 24rem.
    renderMatrix();
    expect(screen.getAllByRole('columnheader')[1]!.className).toContain('sticky');
    expect(screen.getAllByRole('rowheader')[0]!.className).toContain('sticky');
  });

  it('gives each cell one specimen and no caption of its own', () => {
    renderMatrix();
    const cell = screen.getAllByRole('cell')[0]!;
    expect(within(cell).queryByRole('figure')).toBeNull();
    expect(cell.querySelector('figcaption')).toBeNull();
  });
});
