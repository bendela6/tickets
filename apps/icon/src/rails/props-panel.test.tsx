import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app';
import { MATERIALS } from '../doc/constants';
import { newObject } from '../doc/defaults';
import { rotatedBounds } from '../doc/geometry';

const setup = () => {
  const user = userEvent.setup();
  render(<App />);
  return { user };
};

const propsRail = () => screen.getByRole('complementary', { name: 'Properties' });

describe('the on-artboard readout', () => {
  it('is absent while a shape sits upright, since its own box already agrees with the artboard', async () => {
    const { user } = setup();
    await user.keyboard('r');
    expect(within(propsRail()).queryByText('ON ARTBOARD')).not.toBeInTheDocument();
  });

  it('reports the rotated bounding box once a shape turns, since its X/Y/W/H no longer do', async () => {
    const { user } = setup();
    await user.keyboard('r');
    const rotation = within(propsRail()).getByLabelText('ROTATION');
    await user.clear(rotation);
    await user.type(rotation, '45');
    await user.tab();

    // Mirrors what the reducer's `addObject` produces for the first shape on
    // a fresh, default-sized document, so the expectation is derived rather
    // than a copied-down number that would drift silently if the default
    // placement ever changed.
    const rotated = { ...newObject('rect', 1, { width: 512, height: 512 }, 1), rotation: 45 };
    const box = rotatedBounds(rotated);
    const expected = `${Math.round(box.x)}, ${Math.round(box.y)} · ${Math.round(box.w)} × ${Math.round(box.h)}`;

    expect(within(propsRail()).getByText('ON ARTBOARD')).toBeInTheDocument();
    expect(within(propsRail()).getByText(expected)).toBeInTheDocument();
  });
});

describe('the material picker', () => {
  const picker = () => within(propsRail()).getByRole('group', { name: 'Material' });
  const pressed = () =>
    within(picker())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.textContent);

  it('offers seven surfaces and starts on none, which is what a shape arrives wearing', async () => {
    const { user } = setup();
    await user.keyboard('r');
    expect(within(picker()).getAllByRole('button')).toHaveLength(MATERIALS.length + 1);
    expect(pressed()).toEqual(['none']);
  });

  it('sets the surface it names, and shows which one is on — exactly one', async () => {
    const { user } = setup();
    await user.keyboard('r');
    for (const material of MATERIALS) {
      await user.click(within(picker()).getByRole('button', { name: material }));
      expect(pressed()).toEqual([material]);
    }
    await user.click(within(picker()).getByRole('button', { name: 'none' }));
    expect(pressed()).toEqual(['none']);
  });

  it('is one undo away, so choosing one is one thing the user did', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.click(within(picker()).getByRole('button', { name: 'glow' }));
    await user.keyboard('{Meta>}z{/Meta}');
    expect(pressed()).toEqual(['none']);
  });

  it('is not offered for a group, which has no paint for a surface to sit on', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('e');
    await user.keyboard('{Meta>}a{/Meta}');
    await user.keyboard('{Meta>}g{/Meta}');
    expect(within(propsRail()).getByText('GROUP')).toBeInTheDocument();
    expect(within(propsRail()).queryByRole('group', { name: 'Material' })).not.toBeInTheDocument();
  });

  it('reads mixed as no surface pressed when a selection does not share one', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.click(within(picker()).getByRole('button', { name: 'paper' }));
    await user.keyboard('e');
    await user.keyboard('{Meta>}a{/Meta}');
    // Two shapes, one dressed and one not: a pressed button would claim the
    // selection is that surface, which is the one thing known to be untrue.
    expect(within(propsRail()).getByText('SELECTION')).toBeInTheDocument();
    expect(pressed()).toEqual([]);
    // And every button still works — pressing one settles them both.
    await user.click(within(picker()).getByRole('button', { name: 'matte' }));
    expect(pressed()).toEqual(['matte']);
  });
});
