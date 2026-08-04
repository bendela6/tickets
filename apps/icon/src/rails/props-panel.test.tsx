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


describe('the blur field', () => {
  const blur = () => within(propsRail()).getByLabelText('Blur');

  it('starts at zero and sets the radius it is typed, in one undo entry', async () => {
    const { user } = setup();
    await user.keyboard('r');
    expect(blur()).toHaveValue('0');
    await user.clear(blur());
    await user.type(blur(), '12');
    await user.tab();
    expect(blur()).toHaveValue('12');
    await user.keyboard('{Meta>}z{/Meta}');
    expect(blur()).toHaveValue('0');

    // And refuses a negative radius, which no gaussian has.
    await user.clear(blur());
    await user.type(blur(), '-5');
    await user.tab();
    expect(blur()).toHaveValue('0');
  });
});

describe('the shadow control', () => {
  const toggle = () => within(propsRail()).getByRole('button', { name: 'SHADOW' });
  const on = () => toggle().getAttribute('aria-pressed') === 'true';

  it('shows no fields until it is pressed, then the offset, radius, opacity and colour', async () => {
    const { user } = setup();
    await user.keyboard('r');
    expect(on()).toBe(false);
    // Not five fields greyed out: an object either throws a shadow or it does
    // not, and the button is the whole of that question.
    expect(within(propsRail()).queryByLabelText('Shadow x')).not.toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('Shadow radius')).not.toBeInTheDocument();

    await user.click(toggle());
    expect(on()).toBe(true);
    const rail = within(propsRail());
    expect(rail.getByLabelText('Shadow x')).toHaveValue('0');
    expect(rail.getByLabelText('Shadow y')).toHaveValue('16');
    expect(rail.getByLabelText('Shadow radius')).toHaveValue('24');
    expect(rail.getByLabelText('Shadow opacity')).toHaveValue('40');
    expect(rail.getByLabelText('SHADOW light value')).toHaveValue('#25231D');
  });

  it('turns on and off in one press each, and sets a number in one undo entry', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.click(toggle());
    await user.keyboard('{Meta>}z{/Meta}');
    expect(on()).toBe(false);
    await user.click(toggle());
    expect(on()).toBe(true);
    const rail = () => within(propsRail());

    await user.clear(rail().getByLabelText('Shadow y'));
    await user.type(rail().getByLabelText('Shadow y'), '48');
    await user.tab();
    expect(rail().getByLabelText('Shadow y')).toHaveValue('48');
    expect(rail().getByLabelText('Shadow radius')).toHaveValue('24');

    // Out of the fields before the shortcut: ⌘Z is deliberately ignored while
    // a text input has focus, so typing into one cannot undo the last edit.
    await user.click(propsRail());
    await user.keyboard('{Meta>}z{/Meta}');
    // One ⌘Z is back to the shadow as it was, not back to no shadow at all.
    expect(on()).toBe(true);
    expect(rail().getByLabelText('Shadow y')).toHaveValue('16');

    // The colour edits the half the canvas is previewing, like every other pair.
    const hex = () => within(propsRail()).getByLabelText('SHADOW light value');
    await user.clear(hex());
    await user.type(hex(), '#C0382E');
    await user.tab();
    expect(hex()).toHaveValue('#C0382E');
  });

  it('is offered for a group but not for a selection of several, which ⌘G answers', async () => {
    const { user } = setup();
    await user.keyboard('r');
    await user.keyboard('e');
    await user.keyboard('{Meta>}a{/Meta}');
    // "Shadow these two" has two readings, and the one people mean is one
    // shadow under the lot — which is a group, and says so.
    expect(within(propsRail()).getByText('SELECTION')).toBeInTheDocument();
    expect(within(propsRail()).queryByRole('button', { name: 'SHADOW' })).not.toBeInTheDocument();
    expect(within(propsRail()).queryByLabelText('Blur')).not.toBeInTheDocument();

    await user.keyboard('{Meta>}g{/Meta}');
    expect(within(propsRail()).getByText('GROUP')).toBeInTheDocument();
    expect(within(propsRail()).getByLabelText('Blur')).toBeInTheDocument();
    await user.click(toggle());
    expect(on()).toBe(true);
  });
});
