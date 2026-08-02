import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { emptyDocument, newObject } from './doc/defaults';
import { renderSvg } from './render/svg';

/** The document the app opens with, and the board its presets are sized to. */
const START = emptyDocument('untitled.icon');
const BOARD = { width: 512, height: 512 };

const setup = () => {
  const user = userEvent.setup();
  render(<App />);
  return { user };
};

const toggle = () => screen.getByRole('button', { name: 'source' });
const panel = () => screen.getByRole('region', { name: 'SVG source' });
const closed = () => screen.queryByRole('region', { name: 'SVG source' });
/** The markup on screen, exactly as it reads. */
const shown = () => within(panel()).getByRole('code').textContent;

/** A clipboard that records what was written to it. */
function stubClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

describe('showing the SVG the document generates', () => {
  it('opens and closes from the control in the canvas footer', async () => {
    const { user } = setup();
    expect(closed()).not.toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle());
    expect(panel()).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');

    await user.click(toggle());
    expect(closed()).not.toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens and closes from ⌘/', async () => {
    const { user } = setup();
    await user.keyboard('{Meta>}/{/Meta}');
    expect(panel()).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Meta>}/{/Meta}');
    expect(closed()).not.toBeInTheDocument();
  });

  it('is a panel beside the artboard, not a dialog over it', async () => {
    // The point of watching the markup is watching it change as you edit, which
    // is exactly what a modal would hide.
    const { user } = setup();
    await user.click(toggle());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /untitled\.icon artboard/ })).toBeInTheDocument();
  });

  it('shows the exact string the export rasterises, character for character', async () => {
    const { user } = setup();
    await user.click(toggle());
    expect(shown()).toBe(renderSvg(START, { ground: 'light' }));
  });

  it('follows the ground chip, so previewing dark shows the dark markup', async () => {
    const { user } = setup();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'dark' }));
    expect(shown()).toBe(renderSvg(START, { ground: 'dark' }));
    expect(shown()).not.toBe(renderSvg(START, { ground: 'light' }));
  });

  it('updates as the document does', async () => {
    const { user } = setup();
    await user.click(toggle());
    const empty = shown();

    await user.keyboard('r');
    expect(shown()).not.toBe(empty);
    expect(shown()).toBe(
      renderSvg({ ...START, objects: [newObject('rect', 1, BOARD)] }, { ground: 'light' }),
    );
  });

  it('copies that same string, and says that it did', async () => {
    const { user } = setup();
    const writeText = stubClipboard();
    await user.click(toggle());
    await user.keyboard('r');

    await user.click(within(panel()).getByRole('button', { name: 'copy' }));

    expect(writeText).toHaveBeenCalledWith(shown());
    expect(writeText).toHaveBeenCalledWith(
      renderSvg({ ...START, objects: [newObject('rect', 1, BOARD)] }, { ground: 'light' }),
    );
    expect(await within(panel()).findByRole('button', { name: 'copied' })).toBeInTheDocument();
  });

  it('says how many bytes the markup weighs', async () => {
    const { user } = setup();
    await user.click(toggle());
    const markup = renderSvg(START, { ground: 'light' });
    expect(within(panel()).getByText(`${markup.length} bytes`)).toBeInTheDocument();

    await user.keyboard('r');
    const withRect = renderSvg({ ...START, objects: [newObject('rect', 1, BOARD)] }, { ground: 'light' });
    expect(within(panel()).getByText(`${withRect.length} bytes`)).toBeInTheDocument();
  });

  it('is a way of looking rather than an edit — it dirties nothing and undoes nothing', async () => {
    const { user } = setup();
    await user.click(toggle());
    expect(within(screen.getByRole('banner')).queryByText('unsaved')).not.toBeInTheDocument();

    await user.keyboard('r');
    await user.keyboard('{Meta>}z{/Meta}');
    // Undo took the rectangle back, and left the panel exactly where it was.
    expect(panel()).toBeInTheDocument();
    expect(shown()).toBe(renderSvg(START, { ground: 'light' }));
  });
});
