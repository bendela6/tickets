import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app';

const setup = async () => {
  const user = userEvent.setup();
  render(<App />);
  // Nothing about time is interesting on an empty artboard.
  await user.keyboard('r');
  return { user };
};

const states = () => screen.getByRole('group', { name: 'States' });

const openManager = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'States' }));
  return screen.getByRole('list', { name: 'States' });
};

describe('the strip', () => {
  it('starts with one state, which is a legal document', async () => {
    await setup();
    expect(within(states()).getAllByRole('button')).toHaveLength(1);
    expect(within(states()).getByRole('button', { name: 'default' })).toBeInTheDocument();
  });

  it('keeps its shape with one state — there is simply nothing to traverse', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'all' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Transition progress' })).toBeInTheDocument();
  });

  it('counts toward a total, because a transition has two ends', async () => {
    await setup();
    expect(screen.getByText('of 0.40s')).toBeInTheDocument();
  });
});

describe('the state manager', () => {
  it('adds a state', async () => {
    const { user } = await setup();
    const list = await openManager(user);
    await user.click(within(list.parentElement!).getByRole('button', { name: '+ add state' }));
    expect(within(states()).getAllByRole('button')).toHaveLength(2);
  });

  it('will not delete the last state — the floor is one, not two', async () => {
    const { user } = await setup();
    const list = await openManager(user);
    expect(within(list).getByRole('button', { name: 'Delete default' })).toBeDisabled();
  });

  it('deletes down to one once there is more than one', async () => {
    const { user } = await setup();
    const list = await openManager(user);
    await user.click(within(list.parentElement!).getByRole('button', { name: '+ add state' }));
    const rows = screen.getByRole('list', { name: 'States' });
    await user.click(within(rows).getByRole('button', { name: 'Delete state 2' }));
    expect(within(states()).getAllByRole('button')).toHaveLength(1);
  });

  it('renames a state in place', async () => {
    const { user } = await setup();
    const list = await openManager(user);
    await user.click(within(list).getByRole('button', { name: 'default' }));
    const input = screen.getByRole('textbox', { name: 'Rename default' });
    await user.clear(input);
    await user.type(input, 'idle{Enter}');
    expect(within(states()).getByRole('button', { name: 'idle' })).toBeInTheDocument();
  });

  it('cycles a state from settled through the three sustained kinds and back', async () => {
    const { user } = await setup();
    await openManager(user);
    const cycle = () => screen.getByRole('list', { name: 'States' }).querySelector('button[title="Settled or sustained"]')!;
    expect(cycle).toBeTruthy();
    for (const expected of ['turning', 'pulsing', 'travelling', 'settled']) {
      await user.click(cycle());
      expect(cycle()).toHaveTextContent(expected);
    }
  });

  it('marks a sustained state with ↻ on its chip, without opening anything', async () => {
    const { user } = await setup();
    await openManager(user);
    await user.click(
      screen.getByRole('list', { name: 'States' }).querySelector('button[title="Settled or sustained"]')!,
    );
    await user.keyboard('{Escape}');
    expect(within(states()).getByRole('button', { name: 'default ↻' })).toBeInTheDocument();
  });
});

describe('sustained time', () => {
  const makeSustained = async (user: ReturnType<typeof userEvent.setup>) => {
    await openManager(user);
    await user.click(
      screen.getByRole('list', { name: 'States' }).querySelector('button[title="Settled or sustained"]')!,
    );
    await user.keyboard('{Escape}');
  };

  it('swaps the finite scrubber for one with no ends', async () => {
    const { user } = await setup();
    expect(screen.getByRole('slider', { name: 'Transition progress' })).toBeInTheDocument();
    await makeSustained(user);
    expect(screen.getByRole('slider', { name: 'Loop position' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Transition progress' })).not.toBeInTheDocument();
  });

  it('names a cycle instead of counting to a total', async () => {
    const { user } = await setup();
    await makeSustained(user);
    expect(screen.getByText('0.90s loop ↻')).toBeInTheDocument();
    expect(screen.queryByText('of 0.40s')).not.toBeInTheDocument();
  });

  it('clicking the track holds a frame', async () => {
    const { user } = await setup();
    await makeSustained(user);
    const track = screen.getByRole('slider', { name: 'Loop position' });
    track.focus();
    await user.keyboard('{End}');
    expect(screen.getByText(/held 1\.00/)).toBeInTheDocument();
  });
});

describe('timing', () => {
  it('governs the whole document from behind the speed button', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Timing' }));
    // Scoped to SPEED: an object's PACE segment also offers a 2×, and the two
    // mean different things — one is how fast the document runs, the other is
    // one object's place in the running order.
    const speed = screen.getByRole('group', { name: 'SPEED' });
    await user.click(within(speed).getByRole('button', { name: '2×' }));
    expect(screen.getByText(/0\.20s transitions/)).toBeInTheDocument();
    // The strip's own readout follows.
    await user.keyboard('{Escape}');
    expect(screen.getByText('of 0.20s')).toBeInTheDocument();
  });

  it('offers three named ramps and no curve editor', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Timing' }));
    const ramps = screen.getByRole('group', { name: 'RAMP' });
    expect(within(ramps).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'linear',
      'soft',
      'sharp',
    ]);
  });

  it('says what the three values currently mean in seconds', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Timing' }));
    expect(screen.getByText(/rests spread across objects/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'none' }));
    expect(screen.getByText(/all objects rest together/)).toBeInTheDocument();
  });
});

describe('reduced motion', () => {
  it('disables play and replaces the track with a plain statement', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'reduced motion' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.queryByRole('slider', { name: 'Transition progress' })).not.toBeInTheDocument();
    expect(screen.getByText(/holding the default pose/)).toBeInTheDocument();
  });

  it('shows every state’s held pose side by side, which is the design constraint', async () => {
    const { user } = await setup();
    await openManager(user);
    await user.click(
      screen.getByRole('list', { name: 'States' }).parentElement!.querySelector('button')!,
    );
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'reduced motion' }));
    expect(screen.getByText(/HELD POSES/)).toBeInTheDocument();
  });

  it('shows nothing to hold when the artboard is empty', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'reduced motion' }));
    expect(screen.queryByText(/HELD POSES/)).not.toBeInTheDocument();
  });
});

describe('play', () => {
  it('is disabled while there is nothing to animate', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    await user.keyboard('r');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });
});
