// ExamplePanel over a small made-up example: it names the example and shows
// what the app rendered; it shows the code, the result or both, with the
// code beside or under; the code is the app's editor or drawn read-only; it
// says the code was edited and puts it back; it copies the code; it lists the
// problems, the errors under the result while the code is hidden; its bottom
// edge and a split's divider move with the keys; it opens full screen and
// comes back; and the app's own controls sit in its header.

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@bh/ui';
import { problemLines, type CodeProblem } from '../problems';
import { ExamplePanel, type ExamplePanelProps } from './example-panel';

const CODE = 'export function Greeting() {\n  return <p>Hello</p>;\n}\n';

function renderPanel(props: Partial<ExamplePanelProps> = {}) {
  return render(
    <TooltipProvider>
      <ExamplePanel title="Greeting" code={CODE} result={<p>Hello</p>} {...props} />
    </TooltipProvider>,
  );
}

/** The panel on the page; behind the full-screen dialog, hidden from a screen reader. */
function panel(): HTMLElement {
  return screen.getByRole('region', { name: 'Example: Greeting', hidden: true });
}

/** Picks what the panel shows: View, Split or Source. */
async function show(mode: 'View' | 'Split' | 'Source') {
  const modes = screen.getAllByRole('radiogroup', { name: 'Greeting: show' })[0];
  if (!modes) {
    throw new Error('no mode control');
  }
  await userEvent.click(within(modes).getByRole('radio', { name: mode }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExamplePanel', () => {
  it('names the example, and shows what the app rendered', () => {
    renderPanel();
    expect(within(panel()).getByRole('heading', { name: 'Greeting' })).toBeInTheDocument();
    expect(within(panel()).getByText('Hello')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'View' })).toBeChecked();
  });

  it('shows the code, the result, or both', async () => {
    renderPanel();
    // The code's bar names it by its grammar: there while the code is.
    expect(within(panel()).queryByText('TSX')).toBeNull();
    await show('Source');
    expect(within(panel()).queryByText('Hello', { selector: 'p' })).toBeNull();
    expect(within(panel()).getByText('TSX')).toBeInTheDocument();
    await show('Split');
    expect(within(panel()).getByText('Hello', { selector: 'p' })).toBeInTheDocument();
    expect(within(panel()).getByText('TSX')).toBeInTheDocument();
  });

  it('opens on the mode it is given, and puts a split’s code beside the result or under it', async () => {
    renderPanel({ mode: 'split' });
    expect(screen.getByRole('radio', { name: 'Split' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Code beside the result' }));
    expect(screen.getByRole('button', { name: 'Code under the result' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Code under the result' }));
    expect(screen.getByRole('button', { name: 'Code beside the result' })).toBeInTheDocument();
  });

  it('names the code by its file, or by its grammar without one', () => {
    const { unmount } = renderPanel({ mode: 'source', file: 'greeting.tsx' });
    expect(within(panel()).getByText('greeting.tsx')).toBeInTheDocument();
    unmount();
    renderPanel({ mode: 'source', lang: 'yaml', code: 'title: Hello\n' });
    expect(within(panel()).getByText('YAML')).toBeInTheDocument();
  });

  it('draws the app’s editor in place of the read-only code', () => {
    renderPanel({ mode: 'source', editor: <textarea aria-label="Greeting: source" /> });
    expect(screen.getByRole('textbox', { name: 'Greeting: source' })).toBeInTheDocument();
  });

  it('says the code was edited, and puts it back', async () => {
    const onReset = vi.fn();
    const { rerender } = renderPanel({ mode: 'source', onReset });
    expect(screen.getByRole('button', { name: 'Reset the source' })).toBeDisabled();
    expect(within(panel()).queryByText('edited')).toBeNull();
    rerender(
      <TooltipProvider>
        <ExamplePanel
          title="Greeting"
          code={CODE}
          result={<p>Hello</p>}
          mode="source"
          onReset={onReset}
          edited
        />
      </TooltipProvider>,
    );
    expect(within(panel()).getByText('edited')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset the source' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('offers no reset when the app has none', () => {
    renderPanel({ mode: 'source' });
    expect(screen.queryByRole('button', { name: 'Reset the source' })).toBeNull();
  });

  it('copies the code, and says it did', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the source' }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  describe('its problems', () => {
    const PROBLEMS: readonly CodeProblem[] = [
      { line: 2, severity: 'error', message: "Cannot find name 'Hallo'." },
      { severity: 'warning', message: 'A class the site lacks stays unstyled.' },
    ];

    it('lists every one under the code, on its line when known', () => {
      renderPanel({ mode: 'source', problems: PROBLEMS });
      const rows = within(screen.getByRole('list', { name: 'Problems' })).getAllByRole('listitem');
      expect(rows.map((row) => row.textContent)).toEqual([
        "Line 2Cannot find name 'Hallo'.",
        'A class the site lacks stays unstyled.',
      ]);
    });

    it('shows the errors under the result while the code is hidden', () => {
      renderPanel({ problems: PROBLEMS });
      const rows = within(screen.getByRole('list', { name: 'Problems' })).getAllByRole('listitem');
      expect(rows.map((row) => row.textContent)).toEqual(["Line 2Cannot find name 'Hallo'."]);
    });

    it('lists none when there are none', () => {
      renderPanel({ mode: 'split' });
      expect(screen.queryByRole('list', { name: 'Problems' })).toBeNull();
    });
  });

  it('makes the panel taller or shorter from its bottom edge, with the arrow keys', () => {
    renderPanel();
    const edge = screen.getByRole('separator', { name: 'Greeting: height' });
    expect(edge).toHaveAttribute('aria-orientation', 'horizontal');
    // jsdom lays nothing out, so the first step starts from nothing, and the
    // least height holds it.
    fireEvent.keyDown(edge, { key: 'ArrowDown' });
    expect(edge).toHaveAttribute('aria-valuenow', '96');
    fireEvent.keyDown(edge, { key: 'ArrowDown' });
    expect(edge).toHaveAttribute('aria-valuenow', '120');
    fireEvent.keyDown(edge, { key: 'ArrowUp' });
    expect(edge).toHaveAttribute('aria-valuenow', '96');
  });

  describe('full screen', () => {
    it('opens in a dialog named for the example, and leaves the page a note in its place', async () => {
      renderPanel();
      await userEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      const dialog = await screen.findByRole('dialog', { name: 'Greeting' });
      expect(within(dialog).getByText('Hello')).toBeInTheDocument();
      expect(
        within(panel()).getByText('Open full screen. Esc brings it back.'),
      ).toBeInTheDocument();
    });

    it('splits the window between result and code, with a divider the keys move', async () => {
      renderPanel({ mode: 'split' });
      await userEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      const dialog = await screen.findByRole('dialog', { name: 'Greeting' });
      const divider = within(dialog).getByRole('separator', { name: 'Greeting: result and code' });
      expect(divider).toHaveAttribute('aria-valuenow', '60');
      fireEvent.keyDown(divider, { key: 'ArrowDown' });
      expect(divider).toHaveAttribute('aria-valuenow', '65');
      // The bottom edge is the inline panel's alone.
      expect(within(dialog).queryByRole('separator', { name: 'Greeting: height' })).toBeNull();
    });

    it('comes back to the page, focus on Full screen, when it is left', async () => {
      renderPanel();
      await userEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      const dialog = await screen.findByRole('dialog', { name: 'Greeting' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Leave full screen' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(within(panel()).getByText('Hello')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Full screen' })).toHaveFocus();
    });

    it('closes on Escape', async () => {
      renderPanel();
      await userEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      await screen.findByRole('dialog', { name: 'Greeting' });
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('puts the app’s own controls in its header, full screen too', async () => {
    renderPanel({ actions: <button type="button">Phone</button> });
    expect(within(panel()).getByRole('button', { name: 'Phone' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Greeting' });
    expect(within(dialog).getByRole('button', { name: 'Phone' })).toBeInTheDocument();
  });
});

describe('problemLines', () => {
  it('marks each line with its worst problem, and none for a problem on no line', () => {
    const lines = problemLines([
      { line: 3, severity: 'warning', message: 'unused' },
      { line: 3, severity: 'error', message: 'missing' },
      { line: 3, severity: 'warning', message: 'unused again' },
      { line: 5, severity: 'warning', message: 'loose' },
      { severity: 'error', message: 'somewhere' },
    ]);
    expect([...lines]).toEqual([
      [3, 'error'],
      [5, 'warning'],
    ]);
  });
});
