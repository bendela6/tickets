import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import {
  boolean as booleanControl,
  collectDemos,
  definePlayground,
  isDemoError,
  select,
} from '@tickets/ui/gallery';
import { CodeTab } from './code-tab';
import { setHighlighterForTests } from './highlight';
import { SourceTab } from './source-tab';

// collectDemos (rather than a hand-typed literal) widens `playground` to
// `AnyPlayground`, matching what CodeTab/SourceTab actually receive from
// ComponentPage — a hand-built object keeps the narrower per-control-map
// generic and doesn't satisfy the LiveDemo type used by both components.
const demos = collectDemos({
  'src/button.demo.tsx': {
    meta: { title: 'Button', group: 'Form controls' },
    states: [{ name: 'primary', render: () => <b>state-btn</b> }],
    playground: definePlayground({
      controls: {
        variant: select(['primary', 'secondary'], { label: 'variant' }),
        loading: booleanControl(false, { label: 'loading' }),
      },
      render: (v) => (
        <button data-variant={v.variant} data-loading={v.loading}>
          play-btn
        </button>
      ),
    }),
  },
});
const demo = demos[0];
if (!demo || isDemoError(demo)) throw new Error('fixture demo failed to collect');

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

function block(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.pg-code-block');
  if (!el) throw new Error('expected a .pg-code-block in the rendered output');
  return el as HTMLElement;
}

// The fake highlighter below (from the task brief) wraps its input verbatim
// in `<pre>HL:...</pre>` and gets injected via dangerouslySetInnerHTML — safe
// for the Source tab's plain-text fixtures, but the Code tab's generated JSX
// snippets contain raw `<`/`>` that would get reparsed as (broken) markup if
// asserted against post-highlight. So Code tab content is verified in its
// pre-highlight state (plain React text, always exact) and the post-highlight
// assertions only confirm the highlighter ran (the "HL:" marker showed up).
//
// This package has no jest-dom matchers wired up (see the sibling *.test.tsx
// files) — plain `.toBeTruthy()` / direct DOM assertions throughout.
describe('CodeTab', () => {
  beforeEach(() => {
    setHighlighterForTests((code) => `<pre>HL:${code}</pre>`);
  });
  afterEach(() => {
    setHighlighterForTests(null);
  });

  it('shows the generated snippet for the current control values, then highlights it', async () => {
    const { container } = render(
      <CodeTab demo={demo} values={{ variant: 'secondary', loading: false }} />,
    );
    // Before the (mocked, still-async) highlighter resolves, the raw text is
    // already visible — no flash of nothing.
    expect(block(container).textContent).toBe('⧉ Copy<Button variant="secondary" />');
    expect(screen.getByText(/loading unset → omitted/)).toBeTruthy();

    await waitFor(() => {
      expect(block(container).innerHTML).toContain('<pre>HL:');
    });
  });

  it('regenerates and re-highlights the snippet when the values prop changes', async () => {
    const { container, rerender } = render(
      <CodeTab demo={demo} values={{ variant: 'primary', loading: false }} />,
    );
    expect(block(container).textContent).toBe('⧉ Copy<Button />');

    rerender(<CodeTab demo={demo} values={{ variant: 'secondary', loading: true }} />);
    expect(block(container).textContent).toBe('⧉ Copy<Button variant="secondary" loading />');
    expect(screen.queryByText(/unset → omitted/)).toBeNull();

    await waitFor(() => {
      expect(block(container).innerHTML).toContain('<pre>HL:');
    });
  });

  it('copies the generated snippet to the clipboard', async () => {
    const writeText = mockClipboard();
    render(<CodeTab demo={demo} values={{ variant: 'secondary', loading: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('<Button variant="secondary" />'));
  });
});

describe('SourceTab', () => {
  beforeEach(() => {
    setHighlighterForTests((code) => `<pre>HL:${code}</pre>`);
  });
  afterEach(() => {
    setHighlighterForTests(null);
  });

  const source = 'export default function ButtonDemo() {\n  return null;\n}\n';

  it('shows the filename and line count', async () => {
    const { container } = render(<SourceTab demo={demo} source={source} />);
    expect(screen.getByText('BUTTON.DEMO.TSX')).toBeTruthy();
    expect(screen.getByText('4 lines')).toBeTruthy();

    await waitFor(() => expect(block(container).innerHTML).toContain('<pre>HL:'));
  });

  it('shows the raw source before highlighting, then the highlighted markup', async () => {
    const { container } = render(<SourceTab demo={demo} source={source} />);
    expect(block(container).textContent).toBe(`⧉ Copy${source}`);

    await waitFor(() => {
      expect(block(container).textContent).toBe(`⧉ CopyHL:${source}`);
    });
  });

  it('copies the raw source to the clipboard', async () => {
    const writeText = mockClipboard();
    const rawSource = 'const x = 1;\n';
    render(<SourceTab demo={demo} source={rawSource} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(rawSource));
  });

  it('shows a muted note instead of a block when source is unavailable', () => {
    const { container } = render(<SourceTab demo={demo} source={undefined} />);
    expect(screen.getByText(/source unavailable/i)).toBeTruthy();
    expect(container.querySelector('.pg-code-block')).toBeNull();
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
  });
});
