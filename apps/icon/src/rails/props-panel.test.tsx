import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app';
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
