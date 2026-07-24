import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import {
  boolean as booleanControl,
  collectDemos,
  definePlayground,
  isDemoError,
  select,
} from '@tickets/ui/gallery';
import { DemoTab } from './demo-tab';
import { GeneratedCode } from './generated-code';
import { setHighlighterForTests } from './highlight';
import { ImplTab } from './impl-tab';

// collectDemos (rather than a hand-typed literal) widens `playground` to
// `AnyPlayground`, matching what these views actually receive from
// ComponentPage — a hand-built object keeps the narrower per-control-map
// generic and doesn't satisfy the LiveDemo type they share.
function buildDemo(meta: Record<string, unknown> = {}) {
  const demos = collectDemos({
    '../ui/button.demo.tsx': {
      meta: { title: 'Button', group: 'Form controls', ...meta },
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
  return demo;
}

const demo = buildDemo();

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

// The fake highlighter below wraps its input verbatim in `<pre>HL:...</pre>`
// and gets injected via dangerouslySetInnerHTML — safe for the plain-text
// source fixtures, but generated JSX snippets contain raw `<`/`>` that would
// get reparsed as (broken) markup if asserted against post-highlight. So
// snippet content is verified in its pre-highlight state (plain React text,
// always exact) and the post-highlight assertions only confirm the
// highlighter ran (the "HL:" marker showed up).
//
// This package has no jest-dom matchers wired up (see the sibling *.test.tsx
// files) — plain `.toBeTruthy()` / direct DOM assertions throughout.
beforeEach(() => {
  setHighlighterForTests((code) => `<pre>HL:${code}</pre>`);
});
afterEach(() => {
  setHighlighterForTests(null);
});

describe('GeneratedCode', () => {
  it('shows the generated snippet for the current control values, then highlights it', async () => {
    const { container } = render(
      <GeneratedCode demo={demo} values={{ variant: 'secondary', loading: false }} />,
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
      <GeneratedCode demo={demo} values={{ variant: 'primary', loading: false }} />,
    );
    expect(block(container).textContent).toBe('⧉ Copy<Button />');

    rerender(<GeneratedCode demo={demo} values={{ variant: 'secondary', loading: true }} />);
    expect(block(container).textContent).toBe('⧉ Copy<Button variant="secondary" loading />');
    expect(screen.queryByText(/unset → omitted/)).toBeNull();

    await waitFor(() => {
      expect(block(container).innerHTML).toContain('<pre>HL:');
    });
  });

  it('copies the generated snippet to the clipboard', async () => {
    const writeText = mockClipboard();
    render(<GeneratedCode demo={demo} values={{ variant: 'secondary', loading: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('<Button variant="secondary" />'));
  });
});

describe('DemoTab', () => {
  const source = 'export default function ButtonDemo() {\n  return null;\n}\n';

  it('shows the filename and line count', async () => {
    const { container } = render(<DemoTab demo={demo} source={source} />);
    expect(screen.getByText('BUTTON.DEMO.TSX')).toBeTruthy();
    expect(screen.getByText('4 lines')).toBeTruthy();

    await waitFor(() => expect(block(container).innerHTML).toContain('<pre>HL:'));
  });

  it('shows the raw source before highlighting, then the highlighted markup', async () => {
    const { container } = render(<DemoTab demo={demo} source={source} />);
    expect(block(container).textContent).toBe(`⧉ Copy${source}`);

    await waitFor(() => {
      expect(block(container).textContent).toBe(`⧉ CopyHL:${source}`);
    });
  });

  it('copies the raw source to the clipboard', async () => {
    const writeText = mockClipboard();
    const rawSource = 'const x = 1;\n';
    render(<DemoTab demo={demo} source={rawSource} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(rawSource));
  });

  it('shows a muted note instead of a block when source is unavailable', () => {
    const { container } = render(<DemoTab demo={demo} source={undefined} />);
    expect(screen.getByText(/source unavailable/i)).toBeTruthy();
    expect(container.querySelector('.pg-code-block')).toBeNull();
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
  });
});

describe('ImplTab', () => {
  it('loads the convention path (demo path minus `.demo`) and shows it', async () => {
    const load = vi.fn().mockResolvedValue('export function Button() {}\n');
    render(<ImplTab demo={demo} sources={{ '../ui/button.tsx': load }} />);

    expect(screen.getByText('BUTTON.TSX')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('2 lines')).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('only fetches the selected file, and fetches the next one on switch', async () => {
    const main = vi.fn().mockResolvedValue('main\n');
    const registry = vi.fn().mockResolvedValue('registry-source\n');
    const multi = buildDemo({ impl: ['./button.tsx', './button-registry.tsx'] });

    const { container } = render(
      <ImplTab
        demo={multi}
        sources={{ '../ui/button.tsx': main, '../ui/button-registry.tsx': registry }}
      />,
    );

    // Lazy: the unselected file's loader is untouched until it's picked.
    await waitFor(() => expect(main).toHaveBeenCalledTimes(1));
    expect(registry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'button-registry.tsx' }));
    await waitFor(() => expect(registry).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(block(container).textContent).toContain('registry-source'));
  });

  it('names the paths it looked for when nothing resolves', () => {
    const { container } = render(<ImplTab demo={demo} sources={{}} />);
    expect(screen.getByText('../ui/button.tsx')).toBeTruthy();
    expect(container.querySelector('.pg-code-block')).toBeNull();
  });

  it('surfaces a loader rejection instead of spinning forever', async () => {
    const load = vi.fn().mockRejectedValue(new Error('chunk gone'));
    render(<ImplTab demo={demo} sources={{ '../ui/button.tsx': load }} />);
    await waitFor(() => expect(screen.getByText(/chunk gone/)).toBeTruthy());
  });
});
